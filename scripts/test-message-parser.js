/**
 * Test script for the pattern-based message parser
 * Run with: node --experimental-vm-modules scripts/test-message-parser.js
 */

import {
  parseLogMessage,
  isLogRequest,
  extractActivity,
  extractTimeInfo,
  inferCategory,
  routeRequest,
} from '../api/_lib/message-parser.js';

// Test cases
const testCases = [
  // Should succeed with pattern-based extraction
  { message: 'log coding from 9am to 11am', expected: { success: true } },
  { message: 'record gym session from 7am to 8am', expected: { success: true } },
  { message: 'track meeting for 2 hours', expected: { success: true } },
  { message: 'log lunch', expected: { success: true } },
  { message: 'record watching Netflix', expected: { success: true } },
  { message: 'add sleep from 11pm to 7am', expected: { success: true } },
  { message: 'log work from 9:30am to 5:30pm', expected: { success: true } },
  { message: 'track gym 6am-7am', expected: { success: true } },

  // Should fall back to LLM
  { message: 'how was my day yesterday?', expected: { success: false, needsLLM: true } },
  { message: 'show my stats', expected: { success: false, needsLLM: true } },
  { message: 'hello', expected: { success: false, needsLLM: true } },
];

console.log('🧪 Testing Pattern-Based Message Parser\n');
console.log('=' .repeat(60));

// Test isLogRequest
console.log('\n📌 Testing isLogRequest():\n');
const logRequestTests = [
  { input: 'log coding', expected: true },
  { input: 'record gym', expected: true },
  { input: 'track meeting', expected: true },
  { input: 'add workout', expected: true },
  { input: 'I just finished lunch', expected: true },
  { input: 'worked on project', expected: true },
  { input: 'how are you?', expected: false },
  { input: 'show stats', expected: false },
];

logRequestTests.forEach(({ input, expected }) => {
  const result = isLogRequest(input);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} isLogRequest("${input}") = ${result} (expected: ${expected})`);
});

// Test extractActivity
console.log('\n📌 Testing extractActivity():\n');
const activityTests = [
  { input: 'log coding from 9am to 11am', expected: 'Coding' },
  { input: 'record gym session', expected: 'Gym session' },
  { input: 'track meeting with John for 1 hour', expected: 'Meeting with John' },
  { input: 'I just finished lunch', expected: 'Lunch' },
  { input: 'log watching Netflix from 8pm to 10pm', expected: 'Watching Netflix' },
];

activityTests.forEach(({ input, expected }) => {
  const result = extractActivity(input);
  const status = result?.toLowerCase() === expected?.toLowerCase() ? '✅' : '⚠️';
  console.log(`${status} extractActivity("${input}")`);
  console.log(`   Result: "${result}" | Expected: "${expected}"`);
});

// Test extractTimeInfo
console.log('\n📌 Testing extractTimeInfo():\n');
const now = new Date('2026-02-02T12:00:00Z');
const lastEvent = new Date('2026-02-02T10:00:00Z');

const timeTests = [
  { input: 'log coding from 9am to 11am', hasStart: true, hasEnd: true },
  { input: 'track meeting for 2 hours', hasStart: true, hasEnd: true },
  { input: 'log lunch', hasStart: true, hasEnd: true }, // Should use defaults
  { input: 'log gym at 6am', hasStart: true, hasEnd: true },
];

timeTests.forEach(({ input, hasStart, hasEnd }) => {
  const result = extractTimeInfo(input, {
    lastEventEndTime: lastEvent,
    currentTime: now,
    utcOffsetMinutes: -420, // MST
  });
  console.log(`⏰ extractTimeInfo("${input}")`);
  console.log(`   Start: ${result.startTime || 'null'}`);
  console.log(`   End: ${result.endTime || 'null'}`);
  console.log(`   Source: ${result.source}`);
  console.log();
});

// Test inferCategory
console.log('📌 Testing inferCategory():\n');
const categoryTests = [
  { input: 'coding session', expected: 'prod' },
  { input: 'gym workout', expected: 'prod' },
  { input: 'watching Netflix', expected: 'nonprod' },
  { input: 'gaming', expected: 'nonprod' },
  { input: 'lunch break', expected: 'admin' },
  { input: 'sleeping', expected: 'admin' },
  { input: 'commute to work', expected: 'admin' },
];

categoryTests.forEach(({ input, expected }) => {
  const result = inferCategory(input);
  const status = result.category === expected ? '✅' : '⚠️';
  console.log(`${status} inferCategory("${input}")`);
  console.log(`   Category: ${result.category} (confidence: ${result.confidence})`);
  console.log(`   Expected: ${expected}`);
  console.log();
});

// Test full routing
console.log('=' .repeat(60));
console.log('\n📌 Testing Full routeRequest():\n');

testCases.forEach(({ message, expected }) => {
  const result = routeRequest(message, {
    lastEventEndTime: lastEvent,
    currentTime: now,
    utcOffsetMinutes: -420,
  });

  const status = result.success === expected.success ? '✅' : '❌';
  console.log(`${status} routeRequest("${message}")`);
  console.log(`   Tier: ${result.tier} | Method: ${result.method}`);
  if (result.success && result.data) {
    console.log(`   Title: ${result.data.title}`);
    console.log(`   Category: ${result.data.category} (${result.data.categoryConfidence})`);
    console.log(`   Time: ${result.data.startTime} → ${result.data.endTime}`);
    console.log(`   Source: ${result.data.timeSource}`);
  } else if (result.reason) {
    console.log(`   Reason: ${result.reason}`);
  }
  console.log();
});

console.log('=' .repeat(60));
console.log('\n✅ Pattern-based message parser tests complete!\n');
