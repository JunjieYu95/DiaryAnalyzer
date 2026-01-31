/**
 * MCP (Model Context Protocol) Endpoint for Diary Analyzer
 *
 * This endpoint provides tools to log activities to Google Calendar via MCP.
 * Uses stored refresh token for seamless authentication without user interaction.
 */

import { createCalendarEvent, getCalendarList, getCalendarEvents, getLastEventEndTime, parseFlexibleTime } from "../_lib/google-auth.js";
import { sendJson, sendError, parseJsonBody, onlyMethods } from "../_lib/http.js";
import { generateTimeStatsChart } from "../_lib/chart-generator.js";

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
            "Category for the activity: 'prod' (productive work like coding, meetings, learning, exercise), 'admin' (regular life activities including leisure, entertainment, meals, rest, chores - this is normal!), 'nonprod' (ONLY when user explicitly expresses regret/negativity like 'wasted time', 'damn', 'ugh'). Required - infer from title and sentiment.",
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
  {
    name: "diary.getTimeStats",
    description: "Get time spent statistics by category (prod, nonprod, admin) for a date range. Returns a visual chart showing time distribution and a summary. Perfect for questions like 'how did I spend my time this week?' or 'show me my productivity stats'.",
    inputSchema: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "custom"],
          description: "Predefined time period. Use 'custom' with from/to for specific dates. Defaults to 'this_week'.",
          default: "this_week",
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
          description: "Type of chart to generate. Defaults to 'bar' for multi-day periods, 'doughnut' for single day.",
          default: "bar",
        },
        includeChart: {
          type: "boolean",
          description: "Whether to include a visual chart image in the response. Defaults to true.",
          default: true,
        },
        timeZone: {
          type: "string",
          description: "Timezone for the query. Defaults to America/Denver.",
          default: "America/Denver",
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
  "diary.getTimeStats": ["diary:read"],
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

async function handleGetTimeStats(args, utcOffsetMinutes) {
  const timeZone = args.timeZone || "America/Denver";
  const period = args.period || "this_week";
  const includeChart = args.includeChart !== false;
  
  // Calculate date range based on period
  const { startDate, endDate, periodLabel } = calculateDateRange(period, args.from, args.to, utcOffsetMinutes);
  
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

// Calculate date range based on period
function calculateDateRange(period, fromDate, toDate, utcOffsetMinutes) {
  const now = new Date();
  let startDate, endDate, periodLabel;
  
  // Adjust for user's timezone
  if (Number.isFinite(utcOffsetMinutes)) {
    now.setTime(now.getTime() + utcOffsetMinutes * 60 * 1000);
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
          case "diary.getTimeStats":
            result = await handleGetTimeStats(args || {}, utcOffsetMinutes);
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
