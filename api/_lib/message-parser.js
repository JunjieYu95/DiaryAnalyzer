/**
 * Pattern-Based Message Parser for Diary Analyzer
 *
 * This module provides a two-tier request routing system:
 * 1. Pattern-based extraction (rule-based) - tries first to reduce LLM costs
 * 2. Falls back to LLM processing if pattern extraction fails
 *
 * Supports:
 * - Keywords: "log", "record", "track", "add"
 * - Time patterns: "from 7am to 8am", "7am-8am", "at 9am", "until 5pm"
 * - Default time: uses last event end to current time if not specified
 */

// ============================================================================
// Action Detection Patterns
// ============================================================================

// Strong action patterns that definitively indicate logging intent
const LOG_ACTION_PATTERNS = [
  /^(log|record|track|add|note)\b/i,  // Explicit logging verbs at start
  /^(i\s+)?(just\s+)?(finished|completed|did)\s+\w/i,  // "I just finished X"
  /^(i\s+)?(just\s+)?(worked\s+on|started)\s+\w/i,  // "I worked on X"
  /^spent\s+\w/i,  // "spent time on X"
];

// Patterns that indicate this is NOT a log request (questions, queries, etc.)
const NON_LOG_PATTERNS = [
  /^(how|what|when|where|why|who|which|show|get|display|tell|give|find)\b/i,
  /\?$/,  // Ends with question mark
  /^(can|could|would|should|is|are|was|were|do|does|did)\s+(you|i|it|this|that|the|my)\b/i,
  /my\s+(day|time|stats|data|history|events|activities)\b/i,  // Asking about data
];

// Primary action keywords that must appear near the start of the message
const PRIMARY_LOG_KEYWORDS = ['log', 'record', 'track', 'add', 'note'];

// Secondary keywords that indicate logging only if combined with context
const SECONDARY_LOG_KEYWORDS = [
  'finished', 'completed', 'started', 'worked', 'did', 'spent'
];

// ============================================================================
// Time Extraction Patterns
// ============================================================================

// Matches time like: 7am, 7:30am, 7:30 am, 14:30, 2pm, 12:00pm
const TIME_PATTERN = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

// Matches time ranges like: "from 7am to 8am", "7am-8am", "7am to 8am"
const TIME_RANGE_PATTERNS = [
  // "from X to Y" or "from X until Y"
  /from\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|until|till|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  // "X to Y" or "X-Y" (time range)
  /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until|till)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  // "between X and Y"
  /between\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+and\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
];

// Matches single time references
const SINGLE_TIME_PATTERNS = [
  // "at X", "since X", "starting X", "from X"
  /(?:at|since|starting|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  // "until X", "till X", "ending X"
  /(?:until|till|ending|ended\s+at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
];

// Duration patterns like "for 2 hours", "for 30 minutes", "for 1.5 hours"
const DURATION_PATTERNS = [
  /for\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i,
  /for\s+(\d+)\s*(minutes?|mins?|m)\b/i,
  /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i,
  /(\d+)\s*(minutes?|mins?|m)\b/i,
];

// ============================================================================
// Category Detection (from existing code)
// ============================================================================

const CATEGORY_KEYWORDS = {
  prod: [
    "work", "working", "worked", "coding", "code", "programming", "develop",
    "meeting", "meetings", "met with", "call with", "sync", "standup",
    "study", "studying", "studied", "learning", "learn", "course", "class",
    "gym", "workout", "exercise", "exercising", "run", "running", "jog",
    "writing", "write", "wrote", "documentation", "docs",
    "research", "researching", "analysis", "analyzing",
    "planning", "plan", "design", "designing", "architect",
    "review", "reviewing", "code review", "pr review",
    "email", "emails", "correspondence",
    "presentation", "present", "demo",
    "interview", "interviewing",
    "training", "train", "onboarding",
    "debugging", "debug", "fix", "fixing", "fixed",
    "testing", "test", "tests", "qa",
    "deploy", "deployment", "release",
    "brainstorm", "brainstorming", "ideation",
    "project", "task", "tasks", "sprint",
    "reading technical", "documentation",
    "focus", "focused", "deep work",
  ],
  nonprod: [
    "gaming", "game", "games", "played", "playing",
    "netflix", "youtube", "hulu", "streaming", "watching",
    "tv", "television", "movie", "movies", "show", "shows",
    "social media", "twitter", "instagram", "facebook", "tiktok", "reddit",
    "browse", "browsing", "surfing", "internet",
    "scroll", "scrolling",
    "entertainment", "fun", "leisure",
    "hang out", "hanging out", "hung out", "hangout",
    "party", "partying", "parties",
    "drinking", "drinks", "bar", "pub",
    "video call social", "facetime", "zoom social",
    "chatting", "chat", "messaging",
    "shopping", "shop", "online shopping",
    "procrastinat", "distract",
  ],
  admin: [
    "sleep", "sleeping", "slept", "nap", "napping",
    "eat", "eating", "ate", "breakfast", "lunch", "dinner", "meal", "snack",
    "cook", "cooking", "cooked", "prepare food", "meal prep",
    "commute", "commuting", "drive", "driving", "drove", "transit", "bus", "train",
    "shower", "showering", "hygiene", "getting ready", "grooming",
    "chore", "chores", "clean", "cleaning", "laundry", "dishes", "vacuum",
    "grocery", "groceries", "shopping for food",
    "errand", "errands",
    "break", "rest", "resting", "relaxing", "relax",
    "walk", "walking", "stroll",
    "routine", "morning routine", "night routine", "evening routine",
    "appointment", "doctor", "dentist", "haircut",
    "bills", "paying bills", "admin", "administrative",
    "waiting", "wait", "queue",
  ],
};

// ============================================================================
// Main Parser Functions
// ============================================================================

/**
 * Parse a natural language message and extract structured log data
 * @param {string} message - The user's message
 * @param {Object} options - Parsing options
 * @param {Date} options.lastEventEndTime - End time of the last logged event
 * @param {Date} options.currentTime - Current time (default: now)
 * @param {number} options.utcOffsetMinutes - User's UTC offset in minutes
 * @returns {Object|null} - Extracted data or null if parsing failed
 */
export function parseLogMessage(message, options = {}) {
  const {
    lastEventEndTime = null,
    currentTime = new Date(),
    utcOffsetMinutes = 0,
  } = options;

  // Step 1: Check if this looks like a log/record request
  if (!isLogRequest(message)) {
    return { success: false, reason: 'not_log_request', needsLLM: true };
  }

  // Step 2: Extract activity title/description
  const activity = extractActivity(message);
  if (!activity) {
    return { success: false, reason: 'no_activity_found', needsLLM: true };
  }

  // Step 3: Extract time information
  const timeInfo = extractTimeInfo(message, {
    lastEventEndTime,
    currentTime,
    utcOffsetMinutes,
  });

  // Step 4: Determine category
  const categoryInfo = inferCategory(activity);

  // Step 5: Build the result
  const result = {
    success: true,
    needsLLM: false,
    action: 'log',
    data: {
      title: activity,
      category: categoryInfo.category,
      categoryConfidence: categoryInfo.confidence,
      startTime: timeInfo.startTime,
      endTime: timeInfo.endTime,
      timeSource: timeInfo.source,
    },
  };

  // If category confidence is low, suggest LLM verification
  if (categoryInfo.confidence === 'low') {
    result.suggestLLMVerification = true;
  }

  return result;
}

/**
 * Check if the message appears to be a log/record request
 * Uses strict detection to avoid false positives from questions/queries
 */
export function isLogRequest(message) {
  const normalized = message.trim().toLowerCase();

  // First check if this is explicitly NOT a log request (questions, queries)
  for (const pattern of NON_LOG_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }

  // Check against strong action patterns at the start
  for (const pattern of LOG_ACTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // Check for primary log keywords at the start (most reliable)
  const firstWord = normalized.split(/\s+/)[0];
  if (PRIMARY_LOG_KEYWORDS.includes(firstWord)) {
    return true;
  }

  // Check first two words for secondary keywords with context
  const words = normalized.split(/\s+/);
  const firstTwoWords = words.slice(0, 2).join(' ');

  // "I did", "I finished", "I completed", etc.
  if (/^i\s+(did|finished|completed|started|worked|spent)/.test(firstTwoWords)) {
    return true;
  }

  // "just did", "just finished", etc.
  if (/^just\s+(did|finished|completed|started|worked)/.test(firstTwoWords)) {
    return true;
  }

  return false;
}

/**
 * Extract the activity title/description from the message
 */
export function extractActivity(message) {
  let activity = message.trim();

  // Remove leading action words
  const actionPrefixes = [
    /^(log|record|track|add|note)\s+(that\s+)?/i,
    /^(i\s+)?(just\s+)?(did|finished|completed|started|worked\s+on)\s+/i,
    /^(spent\s+time\s+on|was\s+doing)\s+/i,
  ];

  for (const prefix of actionPrefixes) {
    activity = activity.replace(prefix, '');
  }

  // Remove time information from the activity
  const timeRemovalPatterns = [
    /\s*from\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s+(?:to|until|till|-)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    /\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-|until|till)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    /\s*between\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s+and\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    /\s*(?:at|since|starting|from)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    /\s*(?:until|till|ending|ended\s+at)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi,
    /\s*for\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?|m)\b/gi,
  ];

  for (const pattern of timeRemovalPatterns) {
    activity = activity.replace(pattern, '');
  }

  // Clean up the activity text
  activity = activity
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();

  // Capitalize first letter
  if (activity.length > 0) {
    activity = activity.charAt(0).toUpperCase() + activity.slice(1);
  }

  return activity || null;
}

/**
 * Extract time information from the message
 */
export function extractTimeInfo(message, options = {}) {
  const {
    lastEventEndTime = null,
    currentTime = new Date(),
    utcOffsetMinutes = 0,
  } = options;

  const normalized = message.toLowerCase();
  let startTime = null;
  let endTime = null;
  let source = 'default';

  // Try to extract time range
  for (const pattern of TIME_RANGE_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      startTime = parseTimeString(match[1], currentTime, utcOffsetMinutes);
      endTime = parseTimeString(match[2], currentTime, utcOffsetMinutes);
      source = 'explicit_range';
      break;
    }
  }

  // If no range found, try single time + duration
  if (!startTime && !endTime) {
    const durationMatch = findDuration(normalized);
    const singleTimeMatch = findSingleTime(normalized);

    if (durationMatch && singleTimeMatch) {
      // We have both a time and duration
      if (singleTimeMatch.type === 'start') {
        startTime = parseTimeString(singleTimeMatch.time, currentTime, utcOffsetMinutes);
        endTime = addDuration(startTime, durationMatch.hours, durationMatch.minutes);
        source = 'start_plus_duration';
      } else if (singleTimeMatch.type === 'end') {
        endTime = parseTimeString(singleTimeMatch.time, currentTime, utcOffsetMinutes);
        startTime = subtractDuration(endTime, durationMatch.hours, durationMatch.minutes);
        source = 'end_minus_duration';
      }
    } else if (durationMatch) {
      // Duration only - use last event end as start, or calculate from current time
      if (lastEventEndTime) {
        startTime = new Date(lastEventEndTime);
        endTime = addDuration(startTime, durationMatch.hours, durationMatch.minutes);
        source = 'last_event_plus_duration';
      } else {
        endTime = new Date(currentTime);
        startTime = subtractDuration(endTime, durationMatch.hours, durationMatch.minutes);
        source = 'current_minus_duration';
      }
    } else if (singleTimeMatch) {
      // Single time only
      const parsedTime = parseTimeString(singleTimeMatch.time, currentTime, utcOffsetMinutes);
      if (singleTimeMatch.type === 'start') {
        startTime = parsedTime;
        endTime = new Date(currentTime);
        source = 'start_to_now';
      } else if (singleTimeMatch.type === 'end') {
        endTime = parsedTime;
        startTime = lastEventEndTime ? new Date(lastEventEndTime) : null;
        source = lastEventEndTime ? 'last_event_to_end' : 'unknown_to_end';
      }
    }
  }

  // Default: use last event end time to current time
  if (!startTime && !endTime) {
    if (lastEventEndTime) {
      startTime = new Date(lastEventEndTime);
      endTime = new Date(currentTime);
      source = 'last_event_to_now';
    } else {
      // If no last event, we can't determine times - may need LLM
      endTime = new Date(currentTime);
      source = 'end_only';
    }
  }

  return {
    startTime: startTime ? startTime.toISOString() : null,
    endTime: endTime ? endTime.toISOString() : null,
    source,
  };
}

/**
 * Infer category from activity text
 */
export function inferCategory(activity) {
  const normalized = activity.toLowerCase();
  const scores = { prod: 0, nonprod: 0, admin: 0 };

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        // Longer keywords get higher scores
        scores[category] += keyword.length;
      }
    }
  }

  // Find the highest scoring category
  const maxScore = Math.max(scores.prod, scores.nonprod, scores.admin);
  const sortedCategories = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topCategory, topScore] = sortedCategories[0];
  const [secondCategory, secondScore] = sortedCategories[1] || ['', 0];

  // Determine confidence
  let confidence;
  const margin = topScore - secondScore;

  if (topScore >= 10 && margin >= 5) {
    confidence = 'high';
  } else if (topScore >= 5) {
    confidence = 'medium';
  } else if (topScore > 0) {
    confidence = 'low';
  } else {
    // No keywords matched - default to prod with low confidence
    return { category: 'prod', confidence: 'low', scores };
  }

  return { category: topCategory, confidence, scores };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse a time string into a Date object
 */
function parseTimeString(timeStr, baseDate, utcOffsetMinutes) {
  const normalized = timeStr.trim().toLowerCase();
  const match = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);

  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3]?.toLowerCase();

  // Handle 12-hour format
  if (meridiem === 'pm' && hours !== 12) {
    hours += 12;
  } else if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  // Validate
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  // Create date in user's local timezone context
  const now = new Date(baseDate);
  const userLocalDate = new Date(now.getTime() + utcOffsetMinutes * 60 * 1000);

  // Create result with specified time
  const result = new Date(Date.UTC(
    userLocalDate.getUTCFullYear(),
    userLocalDate.getUTCMonth(),
    userLocalDate.getUTCDate(),
    hours,
    minutes,
    0,
    0
  ));

  // Convert from user local to UTC
  result.setTime(result.getTime() - utcOffsetMinutes * 60 * 1000);

  return result;
}

/**
 * Find duration in the message
 */
function findDuration(message) {
  for (const pattern of DURATION_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('h')) {
        return { hours: value, minutes: 0 };
      } else if (unit.startsWith('m')) {
        return { hours: 0, minutes: value };
      }
    }
  }
  return null;
}

/**
 * Find single time reference in the message
 */
function findSingleTime(message) {
  // Check for start-type patterns
  const startPatterns = [
    /(?:at|since|starting|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
    /^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s/i,  // Time at start of message
  ];

  for (const pattern of startPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { time: match[1], type: 'start' };
    }
  }

  // Check for end-type patterns
  const endPatterns = [
    /(?:until|till|ending|ended\s+at)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  ];

  for (const pattern of endPatterns) {
    const match = message.match(pattern);
    if (match) {
      return { time: match[1], type: 'end' };
    }
  }

  return null;
}

/**
 * Add duration to a date
 */
function addDuration(date, hours, minutes) {
  if (!date) return null;
  const result = new Date(date);
  result.setTime(result.getTime() + (hours * 60 + minutes) * 60 * 1000);
  return result;
}

/**
 * Subtract duration from a date
 */
function subtractDuration(date, hours, minutes) {
  if (!date) return null;
  const result = new Date(date);
  result.setTime(result.getTime() - (hours * 60 + minutes) * 60 * 1000);
  return result;
}

// ============================================================================
// Two-Tier Request Router
// ============================================================================

/**
 * Route a user message through the two-tier system
 * @param {string} message - The user's message
 * @param {Object} context - Context including last event time, current time, etc.
 * @returns {Object} - Routing result with action, data, or needsLLM flag
 */
export function routeRequest(message, context = {}) {
  // Tier 1: Try pattern-based extraction
  const parseResult = parseLogMessage(message, context);

  if (parseResult.success && !parseResult.needsLLM) {
    return {
      tier: 1,
      method: 'pattern',
      ...parseResult,
    };
  }

  // Tier 2: Fall back to LLM processing
  return {
    tier: 2,
    method: 'llm',
    reason: parseResult.reason || 'pattern_extraction_failed',
    originalMessage: message,
    partialData: parseResult.data || null,
  };
}

export default {
  parseLogMessage,
  isLogRequest,
  extractActivity,
  extractTimeInfo,
  inferCategory,
  routeRequest,
};
