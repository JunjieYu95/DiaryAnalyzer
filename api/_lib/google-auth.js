/**
 * Google OAuth Helper for server-side token refresh
 *
 * This module handles automatic access token refresh using stored refresh tokens.
 * The refresh token should be stored in the GOOGLE_REFRESH_TOKEN environment variable.
 */

// Cache for access token
let cachedAccessToken = null;
let tokenExpiresAt = 0;

// ============================================================================
// Retry Logic with Exponential Backoff
// ============================================================================

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error is retryable
 * @returns {Promise<any>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => {
      // Retry on network errors and 5xx errors
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return true;
      }
      if (error.status >= 500 && error.status < 600) {
        return true;
      }
      // Retry on rate limiting
      if (error.status === 429) {
        return true;
      }
      return false;
    },
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );

      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms. Error: ${error.message}`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Fetch with retry logic
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return withRetry(async () => {
    const response = await fetch(url, options);

    // Throw error for retryable status codes so retry logic kicks in
    if (response.status >= 500 || response.status === 429) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    return response;
  }, retryOptions);
}

// ============================================================================
// Time Parsing Utilities
// ============================================================================

/**
 * Parse flexible time formats into a Date object
 * Supports: ISO 8601, 'now', simple times like '2:30pm', '14:30', '5pm'
 * @param {string} value - Time string to parse
 * @param {Date} baseDate - Base date for simple time strings (in user's local context)
 * @param {number} utcOffsetMinutes - User's UTC offset in minutes (e.g., -420 for MST)
 * @returns {Date|null} - Parsed date in UTC, or null if invalid
 */
export function parseFlexibleTime(value, baseDate = new Date(), utcOffsetMinutes = undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  // Handle 'now'
  if (normalized === "now") {
    return new Date();
  }

  // Try ISO 8601 format first (already includes timezone info)
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime()) && value.includes("-")) {
    return isoDate;
  }

  // Parse simple time formats: 2:30pm, 14:30, 5pm, 5:00 pm
  const timeRegex = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
  const match = normalized.match(timeRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const meridiem = match[3]?.toLowerCase();

    // Handle 12-hour format
    if (meridiem === "pm" && hours !== 12) {
      hours += 12;
    } else if (meridiem === "am" && hours === 12) {
      hours = 0;
    }

    // Validate hours and minutes
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      // User specified a local time like "2:30pm"
      // We need to convert this to UTC
      
      if (Number.isFinite(utcOffsetMinutes)) {
        // Get today's date in user's local timezone
        const now = new Date();
        const userLocalDate = new Date(now.getTime() + utcOffsetMinutes * 60 * 1000);
        
        // Create a date with the specified time in UTC
        // Then adjust for user's timezone offset
        const result = new Date(Date.UTC(
          userLocalDate.getUTCFullYear(),
          userLocalDate.getUTCMonth(),
          userLocalDate.getUTCDate(),
          hours,
          minutes,
          0,
          0
        ));
        
        // Subtract the offset to get UTC time
        // (utcOffsetMinutes is what we ADD to UTC to get local, so we subtract to go back)
        result.setTime(result.getTime() - utcOffsetMinutes * 60 * 1000);
        
        return result;
      } else {
        // Fallback: use server timezone (not ideal but works for same-timezone users)
        const result = new Date(baseDate);
        result.setHours(hours, minutes, 0, 0);
        return result;
      }
    }
  }

  // Try parsing as a general date string
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getAccessToken() {
  // Check if we have a valid cached token
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  // Get credentials from environment
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Google OAuth credentials. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN."
    );
  }

  // Refresh the access token with retry logic
  const response = await fetchWithRetry("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  }, { maxRetries: 2 });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(
      `Failed to refresh access token: ${error.error_description || error.error || 'Unknown error'}`
    );
  }

  const data = await response.json();
  
  // Cache the token
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedAccessToken;
}

/**
 * Get list of calendars for the authenticated user
 */
export async function getCalendarList() {
  const accessToken = await getAccessToken();

  const response = await fetchWithRetry(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
    { maxRetries: 2 }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Failed to fetch calendar list: ${error.error?.message || 'Unknown error'}`);
  }

  return response.json();
}

/**
 * Find calendar ID by name (exact or partial match)
 */
export async function findCalendarId(calendarName) {
  const calendarList = await getCalendarList();
  
  // Try exact match first
  let calendar = calendarList.items?.find(
    (cal) => cal.summary === calendarName
  );

  // Try case-insensitive match
  if (!calendar) {
    calendar = calendarList.items?.find(
      (cal) => cal.summary?.toLowerCase() === calendarName.toLowerCase()
    );
  }

  // Try partial match
  if (!calendar && calendarName) {
    const searchTerm = calendarName.toLowerCase();
    calendar = calendarList.items?.find((cal) =>
      cal.summary?.toLowerCase().includes(searchTerm)
    );
  }

  return calendar?.id || "primary";
}

/**
 * Create a calendar event
 */
export async function createCalendarEvent(eventData) {
  const accessToken = await getAccessToken();
  const calendarId = await findCalendarId(eventData.calendar);

  // Build the event payload
  const eventPayload = {
    summary: eventData.summary,
    description: eventData.description || "",
  };

  // Handle start/end times
  if (eventData.startDateTime && eventData.endDateTime) {
    eventPayload.start = {
      dateTime: new Date(eventData.startDateTime).toISOString(),
      timeZone: eventData.timeZone || "America/Denver",
    };
    eventPayload.end = {
      dateTime: new Date(eventData.endDateTime).toISOString(),
      timeZone: eventData.timeZone || "America/Denver",
    };
  } else if (eventData.date) {
    // All-day event
    eventPayload.start = { date: eventData.date };
    eventPayload.end = { date: eventData.date };
  } else {
    // Default to current time with 30-minute duration
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60000);
    eventPayload.start = {
      dateTime: now.toISOString(),
      timeZone: eventData.timeZone || "America/Denver",
    };
    eventPayload.end = {
      dateTime: end.toISOString(),
      timeZone: eventData.timeZone || "America/Denver",
    };
  }

  const response = await fetchWithRetry(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    },
    { maxRetries: 2 }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      `Failed to create event: ${error.error?.message || 'Unknown error'}`
    );
  }

  return response.json();
}

/**
 * Get events from a calendar for a date range
 */
export async function getCalendarEvents(options = {}) {
  const accessToken = await getAccessToken();
  const calendarId = options.calendarId || "primary";
  
  // Default to today
  const now = new Date();
  const timeMin = options.timeMin || new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const timeMax = options.timeMax || new Date(now.setHours(23, 59, 59, 999)).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: options.maxResults || "250",
  });

  const response = await fetchWithRetry(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
    { maxRetries: 2 }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(
      `Failed to fetch events: ${error.error?.message || 'Unknown error'}`
    );
  }

  return response.json();
}

/**
 * Get the end time of the most recent event across multiple calendars
 * Used for smart time inference - new activities start where the last one ended
 * @param {string[]} calendarNames - Array of calendar names to query
 * @param {string} timeZone - Timezone for the query
 * @param {number} utcOffsetMinutes - User's UTC offset in minutes
 * @returns {Date|null} - End time of the most recent event, or null if no events today
 */
export async function getLastEventEndTime(calendarNames, timeZone = "America/Denver", utcOffsetMinutes = undefined) {
  const accessToken = await getAccessToken();
  
  // Get today's date range in user's local timezone
  const now = new Date();
  let startOfDay;
  
  if (Number.isFinite(utcOffsetMinutes)) {
    // Calculate user's local midnight in UTC
    const userLocalNow = new Date(now.getTime() + utcOffsetMinutes * 60 * 1000);
    startOfDay = new Date(Date.UTC(
      userLocalNow.getUTCFullYear(),
      userLocalNow.getUTCMonth(),
      userLocalNow.getUTCDate(),
      0, 0, 0, 0
    ));
    // Convert back to UTC
    startOfDay.setTime(startOfDay.getTime() - utcOffsetMinutes * 60 * 1000);
  } else {
    startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
  }
  
  const timeMin = startOfDay.toISOString();
  const timeMax = now.toISOString();

  // Get calendar IDs for all the calendars
  const calendarList = await getCalendarList();
  const calendarIds = [];
  
  for (const name of calendarNames) {
    const cal = calendarList.items?.find(
      (c) => c.summary === name || c.summary?.toLowerCase() === name.toLowerCase()
    );
    if (cal) {
      calendarIds.push(cal.id);
    }
  }

  if (calendarIds.length === 0) {
    return null;
  }

  // Query events from all calendars in parallel with retry logic
  const eventPromises = calendarIds.map(async (calendarId) => {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "50",
      });

      const response = await fetchWithRetry(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
        { maxRetries: 1 } // Lower retries for parallel queries
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.items || [];
    } catch (err) {
      console.warn(`Error fetching events from calendar ${calendarId}:`, err.message);
      return [];
    }
  });

  const allEventsArrays = await Promise.all(eventPromises);
  const allEvents = allEventsArrays.flat();

  if (allEvents.length === 0) {
    return null;
  }

  // Find the event with the latest end time
  let latestEndTime = null;

  for (const event of allEvents) {
    const endTimeStr = event.end?.dateTime;
    if (!endTimeStr) continue;

    const endTime = new Date(endTimeStr);
    if (!latestEndTime || endTime > latestEndTime) {
      latestEndTime = endTime;
    }
  }

  return latestEndTime;
}
