/**
 * Diary Analyzer secure auth service
 *
 * Exchanges Google OAuth authorization codes for access/refresh tokens,
 * stores refresh tokens server-side, and returns short-lived access tokens
 * to the frontend via an HTTP-only session cookie.
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const fetchFn =
    typeof fetch === 'function'
        ? fetch
        : (...args) => import('node-fetch').then(({ default: fetchModule }) => fetchModule(...args));

const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    FRONTEND_ORIGIN = 'http://localhost:8000',
    SESSION_SECRET = 'change-me',
    GOOGLE_REDIRECT_URI = 'postmessage',
    PORT = 8787,
    SESSION_TTL_DAYS = 7
} = process.env;

if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is required');
}

if (!GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_SECRET is required');
}

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SESSION_COOKIE_NAME = 'da_session';
const SESSION_TTL_MS = Number(SESSION_TTL_DAYS) * 24 * 60 * 60 * 1000;
const SESSION_REFRESH_BUFFER_MS = 60 * 1000; // refresh access token 60s before expiry

const app = express();

const allowedOrigins = FRONTEND_ORIGIN.split(',').map(origin => origin.trim());
const defaultSecureCookies = allowedOrigins.some(origin => origin.startsWith('https://'));

const corsOptions = {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));

/**
 * Simple in-memory store for refresh tokens.
 * In production, replace with a durable database or secret manager.
 */
const sessionStore = new Map();

function persistSession(sessionId, payload) {
    sessionStore.set(sessionId, { ...payload, updatedAt: Date.now() });
}

function getSession(sessionId) {
    if (!sessionId) return null;
    const session = sessionStore.get(sessionId);
    if (!session) return null;

    const isExpired = Date.now() - session.createdAt > SESSION_TTL_MS;
    if (isExpired) {
        sessionStore.delete(sessionId);
        return null;
    }
    return session;
}

function destroySession(sessionId) {
    if (sessionId) {
        sessionStore.delete(sessionId);
    }
}

function shouldUseSecureCookies(req) {
    if (req?.headers?.origin) {
        return req.headers.origin.startsWith('https://');
    }

    const forwardedProto = req?.headers?.['x-forwarded-proto'];
    if (forwardedProto) {
        return forwardedProto.split(',')[0].trim() === 'https';
    }

    if (typeof req?.secure === 'boolean') {
        return req.secure;
    }

    return defaultSecureCookies;
}

function buildCookieOptions(req) {
    const secure = shouldUseSecureCookies(req);
    return {
        httpOnly: true,
        secure,
        sameSite: secure ? 'none' : 'lax',
        maxAge: SESSION_TTL_MS,
        path: '/'
    };
}

function setSessionCookie(req, res, sessionId) {
    res.cookie(SESSION_COOKIE_NAME, sessionId, buildCookieOptions(req));
}

async function requestGoogleToken(bodyParams) {
    const response = await fetchFn(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(bodyParams)
    });

    const data = await response.json();
    if (!response.ok) {
        const error = data.error_description || data.error || 'Unknown Google token error';
        throw new Error(error);
    }
    return data;
}

async function exchangeAuthorizationCode(code) {
    return requestGoogleToken({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
    });
}

async function refreshAccessToken(refreshToken) {
    return requestGoogleToken({
        refresh_token: refreshToken,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token'
    });
}

app.get('/health', (_, res) => {
    res.json({
        status: 'ok',
        sessions: sessionStore.size,
        timestamp: new Date().toISOString()
    });
});

app.post('/auth/exchange', async (req, res) => {
    try {
        const { code } = req.body || {};
        if (!code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        const tokenResponse = await exchangeAuthorizationCode(code);
        if (!tokenResponse.refresh_token) {
            return res.status(400).json({
                error: 'Google did not return a refresh token. Re-run with prompt=consent.'
            });
        }

        const sessionId = uuidv4();
        persistSession(sessionId, {
            refreshToken: tokenResponse.refresh_token,
            accessToken: tokenResponse.access_token,
            accessTokenExpiresAt: Date.now() + tokenResponse.expires_in * 1000,
            createdAt: Date.now()
        });

        setSessionCookie(req, res, sessionId);

        res.json({
            accessToken: tokenResponse.access_token,
            expiresIn: tokenResponse.expires_in,
            scope: tokenResponse.scope,
            refreshTokenStored: true
        });
    } catch (error) {
        console.error('Auth exchange error:', error);
        res.status(500).json({ error: error.message || 'Failed to exchange authorization code' });
    }
});

app.get('/auth/session', async (req, res) => {
    try {
        const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
        const session = getSession(sessionId);

        if (!session) {
            return res.status(401).json({ error: 'No active session' });
        }

        let accessToken = session.accessToken;
        let expiresIn = Math.floor((session.accessTokenExpiresAt - Date.now()) / 1000);

        if (!accessToken || session.accessTokenExpiresAt - Date.now() <= SESSION_REFRESH_BUFFER_MS) {
            const updatedTokens = await refreshAccessToken(session.refreshToken);
            accessToken = updatedTokens.access_token;
            expiresIn = updatedTokens.expires_in;

            persistSession(sessionId, {
                ...session,
                accessToken,
                accessTokenExpiresAt: Date.now() + expiresIn * 1000
            });
        }

        res.json({
            accessToken,
            expiresIn,
            source: 'session'
        });
    } catch (error) {
        console.error('Session refresh error:', error);
        res.status(401).json({ error: error.message || 'Session refresh failed' });
    }
});

app.post('/auth/signout', (req, res) => {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    destroySession(sessionId);

    const { maxAge, ...cookieOptions } = buildCookieOptions(req);
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions);

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Secure auth server running on port ${PORT}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});
