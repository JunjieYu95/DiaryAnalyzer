/**
 * MCP (Model Context Protocol) Endpoint for Diary Analyzer
 *
 * This endpoint provides tools to log activities to Google Calendar via MCP.
 * Uses stored refresh token for seamless authentication without user interaction.
 */

import { createCalendarEvent, getCalendarList, getCalendarEvents, getLastEventEndTime, parseFlexibleTime, getAccessToken } from "../_lib/google-auth.js";
import { sendJson, sendError, parseJsonBody, onlyMethods } from "../_lib/http.js";
import { generateTimeStatsChart } from "../_lib/chart-generator.js";
import { routeRequest, parseLogMessage, isLogRequest } from "../_lib/message-parser.js";

// ============================================================================
// Calendar Category Configuration
// ============================================================================

const CALENDAR_MAP = {
  prod: "Actual Diary - Prod",
  nonprod: "Actual Diary - Nonprod",
  admin: "Actual Diary - Admin/Rest/Routine",
};

// Alternative calendar names for flexible matching
const CALENDAR_ALIASES = {
  prod: ["productive", "work", "productivity", "Actual Diary - Prod"],
  nonprod: ["nonproductive", "non-productive", "leisure", "fun", "Actual Diary - Nonprod"],
  admin: ["admin", "rest", "routine", "Actual Diary - Admin/Rest/Routine"],
};

const CATEGORY_CALENDARS = Object.values(CALENDAR_MAP);

// ============================================================================
// MCP Tool Definitions
// ============================================================================

const MCP_TOOLS = [
  {
    name: "diary.log",
    description: `LOG ACTIVITIES TO CALENDAR. Use this tool when the user wants to:
- Log, record, or track an activity they did
- Add an entry to their diary/calendar
- Record time spent on something
- Track what they did during a time period

Examples: "Log that I worked on coding from 9am to 12pm", "Record my gym session", "Track my meeting with John", "I just finished lunch"

This tool creates calendar events. It automatically determines start time from the last logged activity if not specified, and uses current time as end time if not specified.`,
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Activity title/summary. Examples: 'Coding session', 'Team meeting', 'Lunch break', 'Gym workout'. REQUIRED.",
        },
        category: {
          type: "string",
          enum: ["prod", "nonprod", "admin"],
          description: `Activity category. REQUIRED. Infer from title if not specified:
- 'prod': Productive work - coding, meetings, studying, exercising, work tasks, learning, focused work
- 'nonprod': Non-productive leisure - gaming, watching TV, social media, entertainment, hanging out
- 'admin': Administrative/routine - eating, sleeping, commuting, errands, rest, breaks, chores`,
        },
        description: {
          type: "string",
          description: "Optional notes or details about the activity",
        },
        startTime: {
          type: "string",
          description: "Start time. Formats: '9am', '9:30am', '14:30', '2:30pm', 'now', or ISO 8601. If omitted, uses end time of last logged activity (smart continuation).",
        },
        endTime: {
          type: "string",
          description: "End time. Formats: '12pm', '12:30pm', '17:00', '5pm', 'now', or ISO 8601. If omitted, uses current time.",
        },
        timeZone: {
          type: "string",
          description: "IANA timezone. Defaults to America/Denver.",
          default: "America/Denver",
        },
      },
      required: ["title", "category"],
    },
    annotations: {
      title: "Log Activity",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "diary.logHighlight",
    description: `LOG HIGHLIGHTS AND MILESTONES. Use this tool when the user wants to:
- Record a significant achievement or milestone
- Mark a special day or memorable moment
- Add a highlight to their diary

Examples: "Mark today as the day I finished my project", "Add a milestone for completing the marathon", "Record this achievement"

Creates an all-day event with an emoji prefix based on type.`,
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the highlight/milestone. REQUIRED.",
        },
        description: {
          type: "string",
          description: "Additional details about the highlight",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format. Defaults to today.",
        },
        type: {
          type: "string",
          enum: ["highlight", "milestone", "achievement", "memory"],
          description: "Type determines emoji: highlight(⭐), milestone(🎯), achievement(🏆), memory(💭). Defaults to highlight.",
          default: "highlight",
        },
        calendar: {
          type: "string",
          description: 'Target calendar name. Defaults to "Highlights".',
          default: "Highlights",
        },
      },
      required: ["title"],
    },
    annotations: {
      title: "Log Highlight",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  {
    name: "diary.listCalendars",
    description: "LIST AVAILABLE CALENDARS. Shows all Google Calendars the user has access to. Use to discover calendar names for other operations.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      title: "List Calendars",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "diary.queryEvents",
    description: `QUERY CALENDAR EVENTS. Use this tool when the user wants to:
- See what activities they logged on a specific day
- Review their diary entries for a date range
- Check what they did yesterday/last week
- List detailed activities (not just statistics)

DATE MAPPING - Calculate the actual date for queries like:
- "yesterday" → calculate yesterday's date in YYYY-MM-DD
- "last Monday", "last Wednesday" → calculate that day's date
- "January 15th" → "2026-01-15"

Examples:
- "What did I do yesterday?" → date: (yesterday's YYYY-MM-DD)
- "Show my activities from last Monday" → date: (last Monday's YYYY-MM-DD)
- "What have I logged this week?" → from: (Monday's date), to: (today's date)
- "List my activities for January 20th" → date: "2026-01-20"

For TIME STATISTICS with charts, use diary.getTimeStats instead.`,
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Single date to query in YYYY-MM-DD format. Calculate the actual date for queries like 'yesterday', 'last Wednesday', etc. Defaults to today.",
        },
        from: {
          type: "string",
          description: "Range query start date (YYYY-MM-DD). Use with 'to'.",
        },
        to: {
          type: "string",
          description: "Range query end date (YYYY-MM-DD). Use with 'from'.",
        },
        calendar: {
          type: "string",
          description: "Specific calendar name to query. If not specified, queries all diary category calendars (prod, nonprod, admin).",
        },
        includeChart: {
          type: "boolean",
          description: "Whether to include a visual time breakdown chart. Defaults to false.",
          default: false,
        },
        chartType: {
          type: "string",
          enum: ["bar", "pie", "doughnut"],
          description: "Chart type when includeChart is true. Defaults to 'doughnut' for single day, 'bar' for ranges.",
        },
      },
    },
    annotations: {
      title: "Query Events",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "diary.getTimeStats",
    description: `GET TIME STATISTICS WITH CHART. Use this tool when the user wants to:
- See how they spent their time over a period
- Get productivity statistics or breakdown
- View time distribution by category
- Analyze their time usage patterns

PERIOD MAPPING - Use the correct period parameter:
- "today", "how I spent my time today" → period: "today"
- "yesterday", "how I spent my time yesterday" → period: "yesterday"
- "this week", "how I spent my time this week" → period: "this_week"
- "last week", "how I spent my time last week" → period: "last_week"
- "this month", "how I spent my time this month" → period: "this_month"
- "last month", "how I spent my time last month" → period: "last_month"
- Specific date like "last Wednesday", "January 15th", "2026-01-20" → use 'date' parameter with YYYY-MM-DD format
- Custom range like "from Jan 1 to Jan 15" → period: "custom" with from/to parameters

Examples:
- "How did I spend my time this week?" → period: "this_week"
- "Show my productivity for last month" → period: "last_month"
- "What did I do today?" → period: "today"
- "How productive was I yesterday?" → period: "yesterday"
- "Time breakdown for last Wednesday" → date: "2026-01-29" (calculate the actual date)
- "Stats for January 20th" → date: "2026-01-20"
- "Time stats from Jan 1 to Jan 15" → period: "custom", from: "2026-01-01", to: "2026-01-15"

Returns a text summary AND a visual chart showing time distribution by category (productive, admin/rest, non-productive).`,
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"],
          description: "Time period to analyze. Use 'custom' with from/to for date ranges. Ignored if 'date' is provided. Defaults to 'this_week'.",
          default: "this_week",
        },
        date: {
          type: "string",
          description: "Specific date to analyze in YYYY-MM-DD format. Use for queries like 'last Wednesday', 'January 15th'. When provided, overrides 'period' parameter.",
        },
        from: {
          type: "string",
          description: "Start date for custom range (YYYY-MM-DD). Only used when period is 'custom'.",
        },
        to: {
          type: "string",
          description: "End date for custom range (YYYY-MM-DD). Only used when period is 'custom'.",
        },
        chartType: {
          type: "string",
          enum: ["bar", "pie", "doughnut"],
          description: "Chart type. 'bar' shows daily breakdown, 'pie'/'doughnut' show category totals. Defaults to 'bar' for multi-day, 'doughnut' for single day.",
        },
        includeChart: {
          type: "boolean",
          description: "Whether to include a visual chart. Defaults to true.",
          default: true,
        },
        timeZone: {
          type: "string",
          description: "IANA timezone. Defaults to America/Denver.",
          default: "America/Denver",
        },
      },
    },
    annotations: {
      title: "Get Time Stats",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: "diary.processMessage",
    description: `PROCESS NATURAL LANGUAGE MESSAGE with two-tier routing (pattern-based first, then LLM).

This tool accepts natural language messages and attempts to:
1. First use pattern-based extraction (no LLM cost)
2. Fall back to LLM processing only if pattern extraction fails

Examples of messages that can be handled by pattern-based extraction:
- "log coding from 9am to 11am"
- "record gym session"
- "track meeting for 2 hours"
- "log lunch from 12pm to 1pm"

The tool automatically:
- Detects action keywords (log, record, track, add)
- Extracts time patterns (from X to Y, for N hours)
- Uses default time (last event end to now) if not specified
- Infers activity category based on keywords

Returns structured data that can be used to call diary.log directly if pattern extraction succeeds.`,
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The natural language message from the user",
        },
        autoExecute: {
          type: "boolean",
          description: "If true, automatically execute the log action when pattern extraction succeeds. If false, just return the extracted data. Defaults to true.",
          default: true,
        },
      },
      required: ["message"],
    },
    annotations: {
      title: "Process Natural Language Message",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];

// Tool scope requirements
const TOOL_SCOPES = {
  "diary.log": ["diary:write"],
  "diary.logHighlight": ["diary:write"],
  "diary.listCalendars": ["diary:read"],
  "diary.queryEvents": ["diary:read"],
  "diary.getTimeStats": ["diary:read"],
  "diary.processMessage": ["diary:write"],
};

// ============================================================================
// MCP Server Info
// ============================================================================

const SERVER_INFO = {
  name: "diary-analyzer",
  version: "1.2.0",
  vendor: "DiaryAnalyzer",
  description: "Log activities and highlights to Google Calendar. Supports smart category inference, flexible time formats, and automatic time continuation.",
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { listChanged: false, subscribe: false },
  prompts: { listChanged: false },
  logging: {},
};

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check MCP server health and configuration
 * @returns {Object} Health status
 */
async function checkHealth() {
  const checks = {
    server: { status: "ok", version: SERVER_INFO.version },
    tools: { status: "ok", count: MCP_TOOLS.length },
    googleAuth: { status: "unknown" },
    calendars: { status: "unknown" },
  };

  // Check Google auth
  try {
    await getAccessToken();
    checks.googleAuth = { status: "ok" };
  } catch (err) {
    checks.googleAuth = { status: "error", message: err.message };
  }

  // Check calendars if auth is ok
  if (checks.googleAuth.status === "ok") {
    try {
      const calendarList = await getCalendarList();
      const categoryCalendars = Object.values(CALENDAR_MAP);
      const foundCalendars = categoryCalendars.filter(name =>
        calendarList.items?.some(cal =>
          cal.summary === name || cal.summary?.toLowerCase() === name.toLowerCase()
        )
      );

      if (foundCalendars.length === categoryCalendars.length) {
        checks.calendars = { status: "ok", count: calendarList.items?.length || 0, categoryCalendars: foundCalendars };
      } else {
        const missing = categoryCalendars.filter(name => !foundCalendars.includes(name));
        checks.calendars = {
          status: "warning",
          message: `Missing category calendars: ${missing.join(", ")}`,
          found: foundCalendars,
          missing,
        };
      }
    } catch (err) {
      checks.calendars = { status: "error", message: err.message };
    }
  }

  // Overall status
  const hasError = Object.values(checks).some(c => c.status === "error");
  const hasWarning = Object.values(checks).some(c => c.status === "warning");

  return {
    status: hasError ? "unhealthy" : hasWarning ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    checks,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseScopes(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap((v) => String(v).split(","));
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================================
// Smart Category Inference
// ============================================================================

const CATEGORY_KEYWORDS = {
  prod: [
    // Work activities
    'work', 'working', 'coding', 'programming', 'meeting', 'meetings', 'call', 'calls',
    'project', 'task', 'tasks', 'email', 'emails', 'presentation', 'review', 'planning',
    'design', 'develop', 'development', 'debugging', 'testing', 'deploy', 'deployment',
    'standup', 'stand-up', 'sync', 'interview', 'client', 'deadline', 'sprint', 'scrum',
    // Learning
    'study', 'studying', 'learning', 'course', 'tutorial', 'reading', 'research', 'class',
    'lecture', 'workshop', 'training', 'practice', 'lesson', 'homework', 'assignment',
    // Exercise/Health
    'gym', 'workout', 'exercise', 'running', 'run', 'jogging', 'yoga', 'meditation',
    'swimming', 'cycling', 'hiking', 'walking', 'fitness', 'training', 'sports',
    // Creative work
    'writing', 'blog', 'article', 'content', 'creating', 'building', 'making',
    // Professional
    'office', 'conference', 'networking', 'mentor', 'coaching',
  ],
  nonprod: [
    // Entertainment
    'netflix', 'youtube', 'movie', 'movies', 'tv', 'show', 'shows', 'watching', 'streaming',
    'gaming', 'game', 'games', 'playing', 'video game', 'videogame',
    // Social
    'friends', 'hanging out', 'party', 'drinks', 'bar', 'club', 'social', 'chatting',
    'texting', 'scrolling', 'browsing', 'social media', 'instagram', 'twitter', 'tiktok',
    'facebook', 'reddit',
    // Leisure
    'relaxing', 'relax', 'chill', 'chilling', 'leisure', 'fun', 'entertainment',
    'hobby', 'hobbies', 'vacation', 'holiday', 'trip', 'travel',
    // Shopping
    'shopping', 'mall', 'buying',
  ],
  admin: [
    // Daily routine
    'sleep', 'sleeping', 'woke up', 'wake up', 'waking up', 'bed', 'nap', 'rest', 'resting',
    'breakfast', 'lunch', 'dinner', 'eating', 'meal', 'food', 'cooking', 'cook',
    'shower', 'showering', 'bath', 'getting ready', 'morning routine',
    // Commute
    'commute', 'commuting', 'drive', 'driving', 'drove', 'transit', 'bus', 'train', 'subway',
    'uber', 'lyft', 'taxi', 'travel to', 'heading to', 'going to',
    // Chores
    'cleaning', 'clean', 'laundry', 'dishes', 'groceries', 'grocery', 'errands', 'errand',
    'chores', 'housework', 'organizing', 'tidying',
    // Admin tasks
    'appointment', 'doctor', 'dentist', 'bank', 'bills', 'paperwork', 'admin',
    'waiting', 'queue',
    // Breaks
    'break', 'coffee break', 'lunch break', 'pause',
  ],
};

/**
 * Infer category from activity title
 * @param {string} title - Activity title
 * @returns {{ category: string, confidence: string }} - Inferred category and confidence level
 */
function inferCategory(title) {
  if (!title) return { category: null, confidence: 'none' };

  const normalizedTitle = title.toLowerCase();
  const scores = { prod: 0, nonprod: 0, admin: 0 };

  // Check each category's keywords
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedTitle.includes(keyword)) {
        // Longer keyword matches get higher scores
        scores[category] += keyword.length;
      }
    }
  }

  // Find the best match
  const maxScore = Math.max(scores.prod, scores.nonprod, scores.admin);

  if (maxScore === 0) {
    return { category: null, confidence: 'none' };
  }

  // Determine confidence based on score and margin
  const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bestCategory = sortedScores[0][0];
  const secondBest = sortedScores[1][1];
  const margin = maxScore - secondBest;

  let confidence;
  if (maxScore >= 10 && margin >= 5) {
    confidence = 'high';
  } else if (maxScore >= 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { category: bestCategory, confidence };
}

function requireScope(scopes, required) {
  if (scopes.includes("admin")) return true;
  return required.every((scope) => scopes.includes(scope));
}

function getTodayDate(offsetMinutes) {
  const now = new Date();
  if (Number.isFinite(offsetMinutes)) {
    now.setTime(now.getTime() + offsetMinutes * 60 * 1000);
  }
  return now.toISOString().split("T")[0];
}

function parseDateTime(value, defaultToNow = true) {
  if (!value) {
    return defaultToNow ? new Date() : null;
  }
  if (value.toLowerCase() === "now") {
    return new Date();
  }
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid date/time: ${value}`);
  }
  return parsed;
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleLog(args, utcOffsetMinutes) {
  const title = args.title;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw {
      code: -32602,
      message: "title is required and must be a non-empty string",
      data: { field: "title", received: title }
    };
  }

  // Smart category inference
  let category = args.category;
  let wasInferred = false;

  if (!category) {
    const inference = inferCategory(title);
    if (inference.category && inference.confidence !== 'none') {
      category = inference.category;
      wasInferred = true;

      // For low confidence, ask for confirmation (optional - can be disabled)
      if (inference.confidence === 'low' && args._allowLowConfidence !== true) {
        return {
          content: [
            {
              type: "text",
              text: `I inferred "${inference.category}" for "${title}" but I'm not very confident. Which category is correct?\n\n- **prod**: Productive (work, learning, exercise)\n- **nonprod**: Non-productive (leisure, entertainment)\n- **admin**: Admin/Rest (meals, commute, routine)`,
            },
          ],
          isFollowUp: true,
          followUpData: {
            pendingAction: "diary.log",
            pendingArgs: { ...args, _allowLowConfidence: true },
            suggestedCategory: inference.category,
            options: [
              { id: "prod", label: "Productive (work, learning, exercise)" },
              { id: "nonprod", label: "Non-productive (leisure, entertainment)" },
              { id: "admin", label: "Admin/Rest (meals, routine, rest)" },
            ],
          },
        };
      }
    } else {
      // No inference possible - ask user
      return {
        content: [
          {
            type: "text",
            text: `Which category best fits "${title}"?\n\n- **prod**: Productive (work, learning, exercise)\n- **nonprod**: Non-productive (leisure, entertainment)\n- **admin**: Admin/Rest (meals, commute, routine)`,
          },
        ],
        isFollowUp: true,
        followUpData: {
          pendingAction: "diary.log",
          pendingArgs: args,
          options: [
            { id: "prod", label: "Productive (work, learning, exercise)" },
            { id: "nonprod", label: "Non-productive (leisure, entertainment)" },
            { id: "admin", label: "Admin/Rest (meals, routine, rest)" },
          ],
        },
      };
    }
  }

  // Normalize category (handle variations)
  const normalizedCategory = category.toLowerCase().trim();
  const categoryMapping = {
    prod: 'prod',
    productive: 'prod',
    work: 'prod',
    nonprod: 'nonprod',
    'non-prod': 'nonprod',
    'non-productive': 'nonprod',
    nonproductive: 'nonprod',
    leisure: 'nonprod',
    admin: 'admin',
    rest: 'admin',
    routine: 'admin',
  };

  const finalCategory = categoryMapping[normalizedCategory] || normalizedCategory;

  if (!CALENDAR_MAP[finalCategory]) {
    throw {
      code: -32602,
      message: `Invalid category: "${category}". Must be 'prod' (productive), 'nonprod' (non-productive), or 'admin' (routine/rest).`,
      data: {
        field: "category",
        received: category,
        validOptions: Object.keys(CALENDAR_MAP),
      }
    };
  }

  // Use finalCategory for the rest of the function
  const validCategory = finalCategory;

  const timeZone = args.timeZone || "America/Denver";
  
  // Calculate user's local "now" using UTC offset
  // utcOffsetMinutes is the offset from UTC (e.g., -420 for UTC-7/MST)
  const serverNow = new Date();
  let userLocalNow;
  if (Number.isFinite(utcOffsetMinutes)) {
    // Convert server UTC time to user's local time
    // utcOffsetMinutes is negative for west of UTC (e.g., -420 for MST)
    userLocalNow = new Date(serverNow.getTime() + utcOffsetMinutes * 60 * 1000);
  } else {
    userLocalNow = serverNow;
  }

  // Determine end time (default to user's local now)
  let endDateTime;
  if (args.endTime) {
    endDateTime = parseFlexibleTime(args.endTime, userLocalNow, utcOffsetMinutes);
    if (!endDateTime) {
      throw { code: -32602, message: `Invalid end time format: ${args.endTime}` };
    }
  } else {
    endDateTime = serverNow; // Use actual current time for "now"
  }

  // Determine start time (default to last event's end time)
  let startDateTime;
  if (args.startTime) {
    startDateTime = parseFlexibleTime(args.startTime, userLocalNow, utcOffsetMinutes);
    if (!startDateTime) {
      throw { code: -32602, message: `Invalid start time format: ${args.startTime}` };
    }
  } else {
    // Query the last event's end time from all category calendars
    const lastEndTime = await getLastEventEndTime(CATEGORY_CALENDARS, timeZone, utcOffsetMinutes);
    startDateTime = lastEndTime || serverNow;
  }

  // Validate: start should be before end
  if (startDateTime >= endDateTime) {
    // If start >= end, log a warning but proceed (could be same-minute logging)
    console.warn(`Start time (${startDateTime.toISOString()}) is not before end time (${endDateTime.toISOString()})`);
  }

  // Get the calendar name from category
  const calendarName = CALENDAR_MAP[validCategory];

  const eventData = {
    summary: title,
    description: args.description || "",
    calendar: calendarName,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    timeZone: timeZone,
  };

  const result = await createCalendarEvent(eventData);

  // Format times for display using user's UTC offset for accuracy
  const formatTime = (date) => {
    // Apply user's UTC offset to get their local time
    let displayDate = date;
    if (Number.isFinite(utcOffsetMinutes)) {
      displayDate = new Date(date.getTime() + utcOffsetMinutes * 60 * 1000);
    }

    // Format the adjusted time
    const hours = displayDate.getUTCHours();
    const minutes = displayDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minuteStr = minutes.toString().padStart(2, '0');

    return `${hour12}:${minuteStr} ${ampm}`;
  };

  const categoryLabels = {
    prod: "Productive",
    nonprod: "Non-productive",
    admin: "Admin/Rest",
  };

  const inferredNote = wasInferred ? ` (category auto-detected)` : '';

  return {
    content: [
      {
        type: "text",
        text: `✅ Activity logged: "${title}" to ${categoryLabels[validCategory]} calendar (${formatTime(startDateTime)} - ${formatTime(endDateTime)})${inferredNote}`,
      },
    ],
    structuredContent: {
      success: true,
      message: `Activity logged successfully`,
      category: validCategory,
      categoryWasInferred: wasInferred,
      calendar: calendarName,
      event: {
        id: result.id,
        title: result.summary,
        start: result.start?.dateTime || result.start?.date,
        end: result.end?.dateTime || result.end?.date,
        htmlLink: result.htmlLink,
      },
    },
  };
}

async function handleLogHighlight(args, utcOffsetMinutes) {
  const title = args.title;
  if (!title) {
    throw { code: -32602, message: "title is required" };
  }

  const date = args.date || getTodayDate(utcOffsetMinutes);
  const type = args.type || "highlight";
  const typeEmoji = {
    highlight: "⭐",
    milestone: "🎯",
    achievement: "🏆",
    memory: "💭",
  };

  const fullTitle = `${typeEmoji[type] || "⭐"} ${title}`;

  const eventData = {
    summary: fullTitle,
    description: args.description || "",
    calendar: args.calendar || "Highlights",
    date: date,
  };

  const result = await createCalendarEvent(eventData);

  return {
    content: [
      {
        type: "text",
        text: `${type.charAt(0).toUpperCase() + type.slice(1)} logged: "${title}" on ${date}`,
      },
    ],
    structuredContent: {
      success: true,
      message: `${type} logged successfully`,
      event: {
        id: result.id,
        title: result.summary,
        date: date,
        type: type,
        htmlLink: result.htmlLink,
      },
    },
  };
}

async function handleListCalendars() {
  const calendarList = await getCalendarList();
  const calendars = (calendarList.items || []).map((cal) => ({
    id: cal.id,
    name: cal.summary,
    primary: cal.primary || false,
    accessRole: cal.accessRole,
  }));

  return {
    content: [
      {
        type: "text",
        text: `Found ${calendars.length} calendars: ${calendars.map((c) => c.name).join(", ")}`,
      },
    ],
    structuredContent: {
      success: true,
      count: calendars.length,
      calendars,
    },
  };
}

async function handleQueryEvents(args, utcOffsetMinutes) {
  const today = getTodayDate(utcOffsetMinutes);
  let timeMin, timeMax;
  let queryDate = args.date;
  let queryFrom = args.from;
  let queryTo = args.to;

  if (queryDate) {
    timeMin = `${queryDate}T00:00:00Z`;
    timeMax = `${queryDate}T23:59:59Z`;
  } else if (queryFrom && queryTo) {
    timeMin = `${queryFrom}T00:00:00Z`;
    timeMax = `${queryTo}T23:59:59Z`;
  } else {
    queryDate = today;
    timeMin = `${today}T00:00:00Z`;
    timeMax = `${today}T23:59:59Z`;
  }

  let allEvents = [];
  const includeChart = args.includeChart === true;
  const timeZone = args.timeZone || "America/Denver";

  // If a specific calendar is provided, query just that one
  // Otherwise, query all diary category calendars
  if (args.calendar) {
    const options = {
      calendarId: args.calendar,
      timeMin,
      timeMax,
    };
    const result = await getCalendarEvents(options);
    allEvents = (result.items || []).map((event) => ({
      id: event.id,
      title: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      description: event.description,
      calendarName: args.calendar,
    }));
  } else {
    // Query all category calendars for comprehensive results
    const calendarList = await getCalendarList();

    for (const calendarName of CATEGORY_CALENDARS) {
      const calendar = calendarList.items?.find(
        (c) => c.summary === calendarName || c.summary?.toLowerCase() === calendarName.toLowerCase()
      );

      if (calendar) {
        try {
          const result = await getCalendarEvents({
            calendarId: calendar.id,
            timeMin,
            timeMax,
            maxResults: 500,
          });

          const events = (result.items || []).map((event) => ({
            id: event.id,
            title: event.summary,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            description: event.description,
            calendarName: calendar.summary,
            category: calendarName.includes("Prod") && !calendarName.includes("Nonprod") ? "prod" :
                      calendarName.includes("Nonprod") ? "nonprod" : "admin",
          }));

          allEvents.push(...events);
        } catch (err) {
          console.error(`Error fetching events from ${calendarName}:`, err);
        }
      }
    }

    // Sort events by start time
    allEvents.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  // Format events for display
  const formattedEvents = allEvents.map((event) => ({
    id: event.id,
    title: event.summary || event.title,
    start: event.start,
    end: event.end,
    description: event.description,
    category: event.category,
  }));

  // Build text summary with event details
  let textSummary = `Found ${formattedEvents.length} events`;
  if (queryDate) {
    textSummary += ` for ${queryDate}`;
  } else if (queryFrom && queryTo) {
    textSummary += ` from ${queryFrom} to ${queryTo}`;
  }
  textSummary += ":\n\n";

  if (formattedEvents.length > 0) {
    const categoryEmoji = { prod: "✅", nonprod: "⚠️", admin: "🔄" };
    formattedEvents.forEach((event) => {
      const startTime = event.start ? new Date(event.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "All day";
      const endTime = event.end ? new Date(event.end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
      const timeRange = endTime ? `${startTime} - ${endTime}` : startTime;
      const emoji = event.category ? categoryEmoji[event.category] || "" : "";
      textSummary += `${emoji} ${timeRange}: ${event.title || "Untitled"}\n`;
    });
  } else {
    textSummary = `No events found for the specified date(s).`;
  }

  // Build response content
  const content = [
    {
      type: "text",
      text: textSummary,
    },
  ];

  // Generate chart if requested and we have events
  if (includeChart && allEvents.length > 0) {
    try {
      // Calculate start and end dates for stats
      const startDate = new Date(queryDate || queryFrom);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(queryDate || queryTo);
      endDate.setHours(23, 59, 59, 999);

      // Calculate stats from the events
      const stats = calculateTimeStats(allEvents, startDate, endDate);

      if (stats.totalMinutes > 0) {
        // Determine chart type
        let chartType = args.chartType;
        if (!chartType) {
          const isSingleDay = !queryFrom || queryFrom === queryTo || queryDate;
          chartType = isSingleDay ? "doughnut" : "bar";
        }

        // Generate period label
        let periodLabel;
        if (queryDate) {
          periodLabel = new Date(queryDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        } else {
          periodLabel = `${queryFrom} to ${queryTo}`;
        }

        const chartBase64 = await generateTimeStatsChart(stats, periodLabel, chartType);

        if (chartBase64) {
          content.push({
            type: "image",
            data: chartBase64,
            mimeType: "image/png",
          });
        }
      }
    } catch (chartError) {
      console.error("Failed to generate chart:", chartError);
      // Continue without chart
    }
  }

  return {
    content,
    structuredContent: {
      success: true,
      count: formattedEvents.length,
      events: formattedEvents,
    },
  };
}

// ============================================================================
// Time Stats Handler
// ============================================================================

async function handleGetTimeStats(args, utcOffsetMinutes) {
  const timeZone = args.timeZone || "America/Denver";
  const includeChart = args.includeChart !== false;

  // If a specific date is provided, use it instead of period
  let period = args.period || "this_week";
  let singleDate = args.date;

  // Calculate date range based on period or specific date
  const { startDate, endDate, periodLabel } = calculateDateRange(period, args.from, args.to, utcOffsetMinutes, singleDate);
  
  // Fetch events from all category calendars
  const allEvents = await fetchAllCategoryEvents(startDate, endDate, timeZone);
  
  // Calculate time stats by category and by day
  const stats = calculateTimeStats(allEvents, startDate, endDate);
  
  // Format the summary text
  const summaryText = formatStatsSummary(stats, periodLabel);
  
  // Build the response content
  const content = [
    {
      type: "text",
      text: summaryText,
    },
  ];
  
  // Generate chart if requested
  if (includeChart && stats.totalMinutes > 0) {
    try {
      // Determine chart type based on period
      let chartType = args.chartType;
      if (!chartType) {
        // Single day periods get doughnut, multi-day get bar
        const isSingleDay = startDate.toDateString() === endDate.toDateString();
        chartType = isSingleDay ? "doughnut" : "bar";
      }
      
      const chartBase64 = await generateTimeStatsChart(stats, periodLabel, chartType);
      
      if (chartBase64) {
        content.push({
          type: "image",
          data: chartBase64,
          mimeType: "image/png",
        });
      }
    } catch (chartError) {
      console.error("Failed to generate chart:", chartError);
      // Continue without chart - don't fail the whole request
    }
  }
  
  return {
    content,
    structuredContent: {
      success: true,
      period: periodLabel,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      stats: {
        totalMinutes: stats.totalMinutes,
        totalHours: Math.round(stats.totalMinutes / 60 * 10) / 10,
        categories: {
          prod: {
            minutes: stats.prod,
            hours: Math.round(stats.prod / 60 * 10) / 10,
            percentage: stats.totalMinutes > 0 ? Math.round(stats.prod / stats.totalMinutes * 100) : 0,
          },
          nonprod: {
            minutes: stats.nonprod,
            hours: Math.round(stats.nonprod / 60 * 10) / 10,
            percentage: stats.totalMinutes > 0 ? Math.round(stats.nonprod / stats.totalMinutes * 100) : 0,
          },
          admin: {
            minutes: stats.admin,
            hours: Math.round(stats.admin / 60 * 10) / 10,
            percentage: stats.totalMinutes > 0 ? Math.round(stats.admin / stats.totalMinutes * 100) : 0,
          },
        },
        dailyBreakdown: stats.dailyBreakdown,
      },
    },
  };
}

// Calculate date range based on period or specific date
function calculateDateRange(period, fromDate, toDate, utcOffsetMinutes, singleDate) {
  const now = new Date();
  let startDate, endDate, periodLabel;

  // Adjust for user's timezone
  if (Number.isFinite(utcOffsetMinutes)) {
    now.setTime(now.getTime() + utcOffsetMinutes * 60 * 1000);
  }

  // If a specific single date is provided, use it
  if (singleDate) {
    startDate = new Date(singleDate);
    if (isNaN(startDate.getTime())) {
      throw { code: -32602, message: `Invalid date format: ${singleDate}. Use YYYY-MM-DD format.` };
    }
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
    // Format a nice label for the date
    periodLabel = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    return { startDate, endDate, periodLabel };
  }

  switch (period) {
    case "today":
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "Today";
      break;
      
    case "yesterday":
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "Yesterday";
      break;
      
    case "this_week":
      // Start from Monday
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate.setDate(startDate.getDate() + mondayOffset);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "This Week";
      break;
      
    case "last_week":
      startDate = new Date(now);
      const currentDayOfWeek = startDate.getDay();
      const lastMondayOffset = currentDayOfWeek === 0 ? -13 : -6 - currentDayOfWeek;
      startDate.setDate(startDate.getDate() + lastMondayOffset);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "Last Week";
      break;
      
    case "this_month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "This Month";
      break;
      
    case "last_month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "Last Month";
      break;
      
    case "custom":
      if (!fromDate || !toDate) {
        throw { code: -32602, message: "from and to dates are required for custom period" };
      }
      startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = `${fromDate} to ${toDate}`;
      break;
      
    default:
      // Default to this week
      startDate = new Date(now);
      const defaultDayOfWeek = startDate.getDay();
      const defaultMondayOffset = defaultDayOfWeek === 0 ? -6 : 1 - defaultDayOfWeek;
      startDate.setDate(startDate.getDate() + defaultMondayOffset);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      periodLabel = "This Week";
  }
  
  return { startDate, endDate, periodLabel };
}

// Fetch events from all category calendars
async function fetchAllCategoryEvents(startDate, endDate, timeZone) {
  const calendarList = await getCalendarList();
  const allEvents = [];
  
  // Find all category calendars
  for (const calendarName of CATEGORY_CALENDARS) {
    const calendar = calendarList.items?.find(
      (c) => c.summary === calendarName || c.summary?.toLowerCase() === calendarName.toLowerCase()
    );
    
    if (calendar) {
      try {
        const result = await getCalendarEvents({
          calendarId: calendar.id,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          maxResults: 500,
        });
        
        // Add calendar name to each event for categorization
        const events = (result.items || []).map((event) => ({
          ...event,
          calendarName: calendar.summary,
        }));
        
        allEvents.push(...events);
      } catch (err) {
        console.error(`Error fetching events from ${calendarName}:`, err);
      }
    }
  }
  
  return allEvents;
}

// Calculate time statistics from events
function calculateTimeStats(events, startDate, endDate) {
  const stats = {
    prod: 0,
    nonprod: 0,
    admin: 0,
    totalMinutes: 0,
    dailyBreakdown: {},
  };
  
  // Initialize daily breakdown
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split("T")[0];
    stats.dailyBreakdown[dateKey] = {
      date: dateKey,
      displayDate: currentDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      prod: 0,
      nonprod: 0,
      admin: 0,
      total: 0,
    };
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Process each event
  events.forEach((event) => {
    if (!event.start?.dateTime || !event.end?.dateTime) return;
    
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    const duration = (eventEnd - eventStart) / (1000 * 60); // minutes
    
    if (duration <= 0) return;
    
    // Determine category from calendar name
    const calendarName = event.calendarName?.toLowerCase() || "";
    let category = "admin";
    if (calendarName.includes("prod") && !calendarName.includes("nonprod")) {
      category = "prod";
    } else if (calendarName.includes("nonprod")) {
      category = "nonprod";
    }
    
    // Add to totals
    stats[category] += duration;
    stats.totalMinutes += duration;
    
    // Add to daily breakdown
    const dateKey = eventStart.toISOString().split("T")[0];
    if (stats.dailyBreakdown[dateKey]) {
      stats.dailyBreakdown[dateKey][category] += duration;
      stats.dailyBreakdown[dateKey].total += duration;
    }
  });
  
  return stats;
}

// Format statistics summary text
function formatStatsSummary(stats, periodLabel) {
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };
  
  const formatPercentage = (minutes) => {
    if (stats.totalMinutes === 0) return "0%";
    return `${Math.round((minutes / stats.totalMinutes) * 100)}%`;
  };
  
  if (stats.totalMinutes === 0) {
    return `📊 Time Stats for ${periodLabel}\n\nNo tracked activities found for this period.`;
  }
  
  let summary = `📊 Time Stats for ${periodLabel}\n\n`;
  summary += `Total tracked time: ${formatTime(stats.totalMinutes)}\n\n`;
  
  if (stats.prod > 0) {
    summary += `✅ Productive: ${formatTime(stats.prod)} (${formatPercentage(stats.prod)})\n`;
  }
  if (stats.admin > 0) {
    summary += `🔄 Admin/Rest: ${formatTime(stats.admin)} (${formatPercentage(stats.admin)})\n`;
  }
  if (stats.nonprod > 0) {
    summary += `⚠️ Non-productive: ${formatTime(stats.nonprod)} (${formatPercentage(stats.nonprod)})\n`;
  }
  
  return summary;
}

// ============================================================================
// Two-Tier Message Processing Handler
// ============================================================================

/**
 * Process a natural language message using two-tier routing:
 * Tier 1: Pattern-based extraction (no LLM cost)
 * Tier 2: Fall back to LLM processing if pattern extraction fails
 *
 * @param {Object} args - Tool arguments
 * @param {string} args.message - The natural language message
 * @param {boolean} args.autoExecute - Whether to auto-execute on successful extraction
 * @param {number} utcOffsetMinutes - User's UTC offset
 */
async function handleProcessMessage(args, utcOffsetMinutes) {
  const { message, autoExecute = true } = args;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw {
      code: -32602,
      message: "message is required and must be a non-empty string",
      data: { field: "message", received: message }
    };
  }

  const timeZone = "America/Denver"; // Default timezone

  // Get last event end time for default start time calculation
  let lastEventEndTime = null;
  try {
    lastEventEndTime = await getLastEventEndTime(CATEGORY_CALENDARS, timeZone, utcOffsetMinutes);
  } catch (err) {
    console.warn("Failed to get last event end time:", err.message);
  }

  // Route through two-tier system
  const routingResult = routeRequest(message, {
    lastEventEndTime,
    currentTime: new Date(),
    utcOffsetMinutes: utcOffsetMinutes || 0,
  });

  // Tier 1: Pattern-based extraction succeeded
  if (routingResult.tier === 1 && routingResult.success) {
    const extractedData = routingResult.data;

    // If autoExecute is true and we have sufficient data, create the event
    if (autoExecute && extractedData.title && extractedData.startTime && extractedData.endTime) {
      // Check category confidence - if low, still proceed but note it
      const categoryNote = extractedData.categoryConfidence === 'low'
        ? ` (category "${extractedData.category}" was inferred with low confidence)`
        : '';

      try {
        // Call handleLog directly with extracted data
        const logResult = await handleLog({
          title: extractedData.title,
          category: extractedData.category,
          startTime: extractedData.startTime,
          endTime: extractedData.endTime,
          _allowLowConfidence: true, // Skip confirmation for pattern-based extraction
        }, utcOffsetMinutes);

        return {
          content: [
            {
              type: "text",
              text: `⚡ Pattern-based processing (Tier 1 - no LLM cost):\n${logResult.content[0].text}${categoryNote}`,
            },
          ],
          structuredContent: {
            success: true,
            tier: 1,
            method: "pattern",
            timeSource: extractedData.timeSource,
            extractedData,
            logResult: logResult.structuredContent,
          },
        };
      } catch (logError) {
        // If logging fails, return the extracted data so user/LLM can retry
        return {
          content: [
            {
              type: "text",
              text: `⚡ Pattern extraction succeeded but logging failed: ${logError.message}\n\nExtracted data:\n- Title: ${extractedData.title}\n- Category: ${extractedData.category}\n- Start: ${extractedData.startTime}\n- End: ${extractedData.endTime}`,
            },
          ],
          structuredContent: {
            success: false,
            tier: 1,
            method: "pattern",
            extractionSucceeded: true,
            logFailed: true,
            error: logError.message,
            extractedData,
          },
        };
      }
    }

    // Return extracted data without auto-executing
    return {
      content: [
        {
          type: "text",
          text: `⚡ Pattern-based extraction succeeded (Tier 1):\n- Title: ${extractedData.title}\n- Category: ${extractedData.category} (confidence: ${extractedData.categoryConfidence})\n- Start: ${extractedData.startTime || 'not specified'}\n- End: ${extractedData.endTime || 'not specified'}\n- Time source: ${extractedData.timeSource}`,
        },
      ],
      structuredContent: {
        success: true,
        tier: 1,
        method: "pattern",
        autoExecuted: false,
        extractedData,
        readyToLog: !!(extractedData.title && extractedData.startTime && extractedData.endTime),
      },
    };
  }

  // Tier 2: Fall back to LLM processing
  // Return indication that LLM processing is needed
  return {
    content: [
      {
        type: "text",
        text: `🔄 Pattern extraction could not fully parse the message. Reason: ${routingResult.reason || 'unknown'}.\n\nLLM processing recommended for: "${message}"\n\n${routingResult.partialData ? `Partial extraction:\n- Title: ${routingResult.partialData.title || 'not found'}\n- Category: ${routingResult.partialData.category || 'not found'}` : 'No partial data extracted.'}`,
      },
    ],
    structuredContent: {
      success: false,
      tier: 2,
      method: "llm_required",
      reason: routingResult.reason,
      originalMessage: message,
      partialData: routingResult.partialData,
      hint: "Use diary.log tool with appropriate parameters inferred from the message",
    },
    needsLLM: true,
  };
}

// ============================================================================
// MCP JSON-RPC Handler
// ============================================================================

function jsonRpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  };
}

function jsonRpcResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

async function handleMCPRequest(body, headers) {
  const { jsonrpc, id, method, params } = body;

  // Validate JSON-RPC structure
  if (jsonrpc !== "2.0" || !method) {
    return jsonRpcError(id || null, -32600, "Invalid Request");
  }

  // Extract context from headers
  const scopes = parseScopes(headers["x-yukie-scopes"]);
  const headerOffset = headers["x-yukie-utc-offset-minutes"];
  const utcOffsetMinutes =
    headerOffset !== undefined ? Number(headerOffset) : undefined;

  switch (method) {
    case "initialize":
      return jsonRpcResult(id, {
        protocolVersion: "2024-11-05",
        capabilities: SERVER_CAPABILITIES,
        serverInfo: SERVER_INFO,
        instructions: `DIARY ANALYZER - Activity Logging Tools

RECOMMENDED: Use diary.processMessage for natural language input!
This tool uses two-tier processing:
- Tier 1: Pattern-based extraction (no LLM cost) for messages like:
  "log coding from 9am to 11am", "record gym for 1 hour", "track meeting"
- Tier 2: Falls back to LLM only if pattern extraction fails

WHEN TO USE diary.processMessage (PREFERRED):
- User sends any natural language about logging/recording activities
- Let the system automatically extract title, times, and category
- Examples: "log coding from 9am to 11am", "record my gym session", "track lunch"

WHEN TO USE diary.log (DIRECT):
- When you have already parsed the user's intent
- When diary.processMessage indicates LLM processing needed
- User provides structured information

WHEN TO USE diary.logHighlight:
- User wants to mark a MILESTONE, ACHIEVEMENT, or MEMORABLE moment
- User says "Mark this day as...", "Record this achievement"

CATEGORY INFERENCE:
- prod (productive): work, coding, meetings, studying, exercise
- nonprod (leisure): gaming, watching TV, social media, entertainment
- admin (routine): eating, sleeping, commuting, errands, rest

The system auto-infers category from activity titles. Start time defaults to the end of the last logged activity.`,
      });

    case "initialized":
      return jsonRpcResult(id, {});

    case "ping":
      return jsonRpcResult(id, { pong: true });

    case "tools/list":
      return jsonRpcResult(id, { tools: MCP_TOOLS });

    case "tools/call": {
      const { name, arguments: args } = params || {};

      if (!name) {
        return jsonRpcError(id, -32602, "Missing tool name");
      }

      // Find the tool
      const tool = MCP_TOOLS.find((t) => t.name === name);
      if (!tool) {
        return jsonRpcError(id, -32003, `Tool not found: ${name}`);
      }

      // Check required scopes
      const requiredScopes = TOOL_SCOPES[name] || [];
      if (requiredScopes.length > 0 && !requireScope(scopes, requiredScopes)) {
        return jsonRpcError(id, -32602, "Insufficient permissions", {
          required: requiredScopes,
          provided: scopes,
        });
      }

      try {
        let result;

        switch (name) {
          case "diary.log":
            result = await handleLog(args || {}, utcOffsetMinutes);
            break;
          case "diary.logHighlight":
            result = await handleLogHighlight(args || {}, utcOffsetMinutes);
            break;
          case "diary.listCalendars":
            result = await handleListCalendars();
            break;
          case "diary.queryEvents":
            result = await handleQueryEvents(args || {}, utcOffsetMinutes);
            break;
          case "diary.getTimeStats":
            result = await handleGetTimeStats(args || {}, utcOffsetMinutes);
            break;
          case "diary.processMessage":
            result = await handleProcessMessage(args || {}, utcOffsetMinutes);
            break;
          default:
            return jsonRpcError(id, -32003, `Tool not implemented: ${name}`);
        }

        return jsonRpcResult(id, result);
      } catch (err) {
        console.error(`Tool ${name} error:`, err);

        // Handle structured errors
        if (err.code && err.message) {
          return jsonRpcError(id, err.code, err.message, err.data);
        }

        // Handle Google API errors
        if (err.message?.includes('Failed to')) {
          return jsonRpcError(id, -32603, err.message, {
            tool: name,
            hint: "Check Google Calendar API configuration and permissions",
          });
        }

        // Generic error with helpful context
        return jsonRpcError(id, -32603, err.message || "Internal error", {
          tool: name,
          errorType: err.name || 'Error',
        });
      }
    }

    case "resources/list":
      return jsonRpcResult(id, { resources: [] });

    case "prompts/list":
      return jsonRpcResult(id, { prompts: [] });

    default:
      return jsonRpcError(id, -32601, `Unknown method: ${method}`);
  }
}

// ============================================================================
// HTTP Handler
// ============================================================================

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Yukie-User-Id, X-Yukie-Scopes, X-Yukie-Request-Id, X-Yukie-UTC-Offset-Minutes"
  );

  // Handle preflight
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Handle GET request for server info or health check
  if (req.method === "GET") {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // Health check endpoint
    if (url.searchParams.has('health') || url.pathname.endsWith('/health')) {
      try {
        const health = await checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
        sendJson(res, statusCode, health);
      } catch (err) {
        sendJson(res, 503, {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: err.message,
        });
      }
      return;
    }

    // Server info (default GET)
    sendJson(res, 200, {
      ...SERVER_INFO,
      protocol: "mcp",
      protocolVersion: "2024-11-05",
      capabilities: SERVER_CAPABILITIES,
      toolCount: MCP_TOOLS.length,
      tools: MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description.split('\n')[0], // First line only for summary
        annotations: t.annotations,
      })),
      healthEndpoint: "?health",
    });
    return;
  }

  // Handle POST requests
  try {
    const m = onlyMethods(req, ["GET", "POST", "OPTIONS"]);
    if (m) throw m;

    const body = await parseJsonBody(req);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // Quick message endpoint - simplified API for two-tier routing
    // POST /api/mcp?quick or POST with { "message": "..." } (no jsonrpc field)
    if (url.searchParams.has('quick') || (body.message && !body.jsonrpc)) {
      const headerOffset = req.headers["x-yukie-utc-offset-minutes"];
      const utcOffsetMinutes = headerOffset !== undefined ? Number(headerOffset) : undefined;

      try {
        const result = await handleProcessMessage({
          message: body.message,
          autoExecute: body.autoExecute !== false, // Default true
        }, utcOffsetMinutes);

        sendJson(res, 200, {
          success: result.structuredContent?.success || false,
          tier: result.structuredContent?.tier || 2,
          method: result.structuredContent?.method || 'unknown',
          message: result.content?.[0]?.text || 'No response',
          data: result.structuredContent,
          needsLLM: result.needsLLM || false,
        });
      } catch (err) {
        sendJson(res, 400, {
          success: false,
          error: err.message || 'Processing failed',
          code: err.code || -32603,
        });
      }
      return;
    }

    // Standard JSON-RPC handling
    const result = await handleMCPRequest(body, req.headers);

    sendJson(res, result.error ? 400 : 200, result);
  } catch (err) {
    sendError(res, err);
  }
}
