// Supabase Edge Function: Calendar API Proxy
// This function proxies requests to Google Calendar API using stored tokens
// It automatically refreshes tokens when they expire

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

interface CalendarRequest {
  user_id: string;
  endpoint: string;      // e.g., "users/me/calendarList" or "calendars/{calendarId}/events"
  method?: string;       // GET, POST, PUT, DELETE (default: GET)
  body?: object;         // Request body for POST/PUT
  params?: Record<string, string>; // Query parameters
}

interface TokenData {
  id: string;
  google_access_token: string;
  google_refresh_token: string | null;
  token_expires_at: string;
}

// Refresh the access token using stored refresh token
async function refreshAccessToken(
  supabase: any,
  userData: TokenData,
  clientId: string,
  clientSecret: string
): Promise<string> {
  if (!userData.google_refresh_token) {
    throw new Error("No refresh token available. Please sign in again.");
  }

  console.log("Refreshing access token...");

  const refreshResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: userData.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshResponse.ok) {
    const error = await refreshResponse.text();
    console.error("Token refresh failed:", error);
    
    if (error.includes("invalid_grant")) {
      // Clear invalid refresh token
      await supabase
        .from("user_tokens")
        .update({ google_refresh_token: null })
        .eq("id", userData.id);
      
      throw new Error("SESSION_EXPIRED");
    }
    
    throw new Error(`Token refresh failed: ${error}`);
  }

  const tokens = await refreshResponse.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Update stored token
  await supabase
    .from("user_tokens")
    .update({
      google_access_token: tokens.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.id);

  console.log("Token refreshed successfully");
  return tokens.access_token;
}

// Check if token is expired or about to expire (within 5 minutes)
function isTokenExpired(expiresAt: string): boolean {
  const expirationTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return now > (expirationTime - fiveMinutes);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Google OAuth credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body: CalendarRequest = await req.json();
    console.log("Calendar proxy request:", body.endpoint);

    if (!body.user_id || !body.endpoint) {
      throw new Error("Missing user_id or endpoint");
    }

    // Get user's tokens
    const { data: userData, error: fetchError } = await supabase
      .from("user_tokens")
      .select("id, google_access_token, google_refresh_token, token_expires_at")
      .eq("id", body.user_id)
      .single();

    if (fetchError || !userData) {
      throw new Error("User not found. Please sign in again.");
    }

    let accessToken = userData.google_access_token;

    // Check if token needs refresh
    if (isTokenExpired(userData.token_expires_at)) {
      console.log("Token expired, refreshing...");
      accessToken = await refreshAccessToken(
        supabase,
        userData,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET
      );
    }

    // Build the Google Calendar API URL
    let apiUrl = `${GOOGLE_CALENDAR_BASE}/${body.endpoint}`;
    
    if (body.params) {
      const searchParams = new URLSearchParams(body.params);
      apiUrl += `?${searchParams.toString()}`;
    }

    console.log("Calling Google Calendar API:", apiUrl);

    // Make request to Google Calendar API
    const calendarResponse = await fetch(apiUrl, {
      method: body.method || "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body.body ? JSON.stringify(body.body) : undefined,
    });

    // Handle 401 - try to refresh token once
    if (calendarResponse.status === 401) {
      console.log("Got 401, attempting token refresh...");
      
      try {
        accessToken = await refreshAccessToken(
          supabase,
          userData,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET
        );

        // Retry the request
        const retryResponse = await fetch(apiUrl, {
          method: body.method || "GET",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: body.body ? JSON.stringify(body.body) : undefined,
        });

        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          throw new Error(`Calendar API error after refresh: ${retryResponse.status} - ${errorText}`);
        }

        const data = await retryResponse.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });

      } catch (refreshError) {
        if (refreshError.message === "SESSION_EXPIRED") {
          return new Response(
            JSON.stringify({
              error: "SESSION_EXPIRED",
              message: "Your session has expired. Please sign in again.",
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 401,
            }
          );
        }
        throw refreshError;
      }
    }

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      throw new Error(`Calendar API error: ${calendarResponse.status} - ${errorText}`);
    }

    const data = await calendarResponse.json();
    
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error:", error.message);

    const status = error.message === "SESSION_EXPIRED" ? 401 : 400;
    
    return new Response(
      JSON.stringify({
        error: error.message === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : "ERROR",
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      }
    );
  }
});
