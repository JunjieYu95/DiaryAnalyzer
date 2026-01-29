/**
 * MCP (Model Context Protocol) Endpoint for Diary Analyzer
 *
 * This endpoint provides tools to log activities to Google Calendar via MCP.
 * Uses stored refresh token for seamless authentication without user interaction.
 */

import { createCalendarEvent, getCalendarList, getCalendarEvents, getLastEventEndTime, parseFlexibleTime } from "../_lib/google-auth.js";
import { sendJson, sendError, parseJsonBody, onlyMethods } from "../_lib/http.js";

// ============================================================================
// Calendar Category Configuration
// ============================================================================

const CALENDAR_MAP = {
  prod: "Actual Diary - Prod",
  nonprod: "Actual Diary -Nonprod",
  admin: "Actual Diary - Admin/Rest/Routine",
};

const CATEGORY_CALENDARS = Object.values(CALENDAR_MAP);

// ============================================================================
// MCP Tool Definitions
// ============================================================================

const MCP_TOOLS = [
  {
    name: "diary.log",
    description:
      "Log an activity to Google Calendar. Automatically uses the end time of the last logged activity as start time, and current time as end time if not specified.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title/summary of the activity (required)",
        },
        category: {
          type: "string",
          enum: ["prod", "nonprod", "admin"],
          description:
            "Category for the activity: 'prod' (productive work like coding, meetings, learning), 'nonprod' (leisure, entertainment, social), 'admin' (routine tasks, rest, admin work). Required - infer from title if not explicitly specified.",
        },
        description: {
          type: "string",
          description: "Optional description or notes about the activity",
        },
        startTime: {
          type: "string",
          description:
            "Start time: ISO 8601 format, 'now', or simple time like '2:30pm', '14:30'. If omitted, uses the end time of the last logged activity.",
        },
        endTime: {
          type: "string",
          description:
            "End time: ISO 8601 format, 'now', or simple time like '5pm', '17:00'. If omitted, uses current time.",
        },
        timeZone: {
          type: "string",
          description: "Timezone for the event. Defaults to America/Denver.",
          default: "America/Denver",
        },
      },
      required: ["title", "category"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
  },
  {
    name: "diary.logHighlight",
    description:
      "Log a highlight or milestone to Google Calendar. Creates an all-day event.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the highlight/milestone (required)",
        },
        description: {
          type: "string",
          description: "Description of the highlight",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format. Defaults to today.",
        },
        type: {
          type: "string",
          enum: ["highlight", "milestone", "achievement", "memory"],
          description: "Type of the entry. Prefixed to the title.",
          default: "highlight",
        },
        calendar: {
          type: "string",
          description: 'Calendar name. Defaults to "Highlights".',
          default: "Highlights",
        },
      },
      required: ["title"],
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
  },
  {
    name: "diary.listCalendars",
    description: "List all available Google Calendars for the authenticated account.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    },
  },
  {
    name: "diary.queryEvents",
    description: "Query calendar events for a specific date or date range.",
    inputSchema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date to query in YYYY-MM-DD format. Defaults to today.",
        },
        from: {
          type: "string",
          description: "Start date for range query (YYYY-MM-DD).",
        },
        to: {
          type: "string",
          description: "End date for range query (YYYY-MM-DD).",
        },
        calendar: {
          type: "string",
          description: "Calendar name to query. Defaults to primary calendar.",
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
    },
  },
];

// Tool scope requirements
const TOOL_SCOPES = {
  "diary.log": ["diary:write"],
  "diary.logHighlight": ["diary:write"],
  "diary.listCalendars": ["diary:read"],
  "diary.queryEvents": ["diary:read"],
};

// ============================================================================
// MCP Server Info
// ============================================================================

const SERVER_INFO = {
  name: "diary-analyzer",
  version: "1.0.0",
};

const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { listChanged: false, subscribe: false },
  prompts: { listChanged: false },
};

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
  if (!title) {
    throw { code: -32602, message: "title is required" };
  }

  const category = args.category;
  
  // Check if category confidence is low - return follow-up question
  if (args._categoryConfidence === 'low' || !category) {
    return {
      content: [
        {
          type: "text",
          text: `Which category best fits "${title}"?`,
        },
      ],
      isFollowUp: true,
      followUpData: {
        pendingAction: "diary.log",
        pendingArgs: { ...args, _categoryConfidence: undefined },
        options: [
          { id: "prod", label: "Productive (work, learning, exercise)" },
          { id: "nonprod", label: "Non-productive (leisure, entertainment)" },
          { id: "admin", label: "Admin/Rest (meals, routine, rest)" },
        ],
      },
    };
  }

  if (!CALENDAR_MAP[category]) {
    throw { code: -32602, message: "category must be 'prod', 'nonprod', or 'admin'" };
  }

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
  const calendarName = CALENDAR_MAP[category];

  const eventData = {
    summary: title,
    description: args.description || "",
    calendar: calendarName,
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    timeZone: timeZone,
  };

  const result = await createCalendarEvent(eventData);

  // Format times for display
  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timeZone,
    });
  };

  const categoryLabels = {
    prod: "Productive",
    nonprod: "Non-productive",
    admin: "Admin/Rest",
  };

  return {
    content: [
      {
        type: "text",
        text: `Activity logged: "${title}" to ${categoryLabels[category]} calendar (${formatTime(startDateTime)} - ${formatTime(endDateTime)})`,
      },
    ],
    structuredContent: {
      success: true,
      message: `Activity logged successfully`,
      category: category,
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

  if (args.date) {
    timeMin = `${args.date}T00:00:00Z`;
    timeMax = `${args.date}T23:59:59Z`;
  } else if (args.from && args.to) {
    timeMin = `${args.from}T00:00:00Z`;
    timeMax = `${args.to}T23:59:59Z`;
  } else {
    timeMin = `${today}T00:00:00Z`;
    timeMax = `${today}T23:59:59Z`;
  }

  const options = {
    calendarId: args.calendar || "primary",
    timeMin,
    timeMax,
  };

  const result = await getCalendarEvents(options);
  const events = (result.items || []).map((event) => ({
    id: event.id,
    title: event.summary,
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    description: event.description,
  }));

  return {
    content: [
      {
        type: "text",
        text: `Found ${events.length} events for the specified date(s).`,
      },
    ],
    structuredContent: {
      success: true,
      count: events.length,
      events,
    },
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
        instructions:
          "Log activities and highlights to Google Calendar. Use diary.log for activities and diary.logHighlight for milestones.",
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
          default:
            return jsonRpcError(id, -32003, `Tool not implemented: ${name}`);
        }

        return jsonRpcResult(id, result);
      } catch (err) {
        if (err.code && err.message) {
          return jsonRpcError(id, err.code, err.message);
        }
        return jsonRpcError(id, -32603, err.message || "Internal error");
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

  // Handle GET request for server info
  if (req.method === "GET") {
    sendJson(res, 200, {
      ...SERVER_INFO,
      protocol: "mcp",
      protocolVersion: "2024-11-05",
      capabilities: SERVER_CAPABILITIES,
      toolCount: MCP_TOOLS.length,
      tools: MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
    });
    return;
  }

  // Handle POST for JSON-RPC
  try {
    const m = onlyMethods(req, ["GET", "POST", "OPTIONS"]);
    if (m) throw m;

    const body = await parseJsonBody(req);
    const result = await handleMCPRequest(body, req.headers);

    sendJson(res, result.error ? 400 : 200, result);
  } catch (err) {
    sendError(res, err);
  }
}
