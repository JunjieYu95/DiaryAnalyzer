#!/usr/bin/env node
/**
 * Test script for diary.getTimeStats MCP tool
 * 
 * This script tests the time stats endpoint locally or against the deployed version.
 * It saves the generated chart as a PNG file for visual verification.
 * 
 * Usage:
 *   node scripts/test-time-stats.js [local|prod]
 *   
 * Examples:
 *   node scripts/test-time-stats.js local   # Test against local server
 *   node scripts/test-time-stats.js prod    # Test against production
 *   node scripts/test-time-stats.js         # Default: local
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const ENDPOINTS = {
  local: 'http://localhost:3000/api/mcp',
  prod: 'https://diary-analyzer-zeta.vercel.app/api/mcp',
};

const env = process.argv[2] || 'local';
const MCP_ENDPOINT = ENDPOINTS[env] || ENDPOINTS.local;

console.log(`\n🧪 Testing diary.getTimeStats against: ${MCP_ENDPOINT}\n`);

// Helper to make MCP JSON-RPC requests
async function mcpRequest(method, params = {}) {
  const response = await fetch(MCP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Yukie-Scopes': 'admin',
      'X-Yukie-UTC-Offset-Minutes': String(-new Date().getTimezoneOffset()),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(`MCP Error ${result.error.code}: ${result.error.message}`);
  }

  return result.result;
}

// Test 1: List available tools
async function testListTools() {
  console.log('📋 Test 1: Listing available tools...');
  
  const result = await mcpRequest('tools/list');
  const tools = result.tools || [];
  
  console.log(`   Found ${tools.length} tools:`);
  tools.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description.substring(0, 60)}...`);
  });
  
  const hasTimeStats = tools.some(t => t.name === 'diary.getTimeStats');
  if (hasTimeStats) {
    console.log('   ✅ diary.getTimeStats tool is available!\n');
  } else {
    console.log('   ❌ diary.getTimeStats tool NOT found!\n');
    console.log('   Available tools:', tools.map(t => t.name).join(', '));
  }
  
  return hasTimeStats;
}

// Test 2: Call diary.getTimeStats
async function testGetTimeStats(period = 'this_week') {
  console.log(`📊 Test 2: Calling diary.getTimeStats (period: ${period})...`);
  
  const result = await mcpRequest('tools/call', {
    name: 'diary.getTimeStats',
    arguments: {
      period,
      includeChart: true,
      chartType: 'bar',
    },
  });

  console.log('\n   Response content:');
  
  let hasImage = false;
  let imageData = null;
  
  for (const content of result.content || []) {
    if (content.type === 'text') {
      console.log('   📝 Text response:');
      console.log('   ' + content.text.split('\n').join('\n   '));
    } else if (content.type === 'image') {
      hasImage = true;
      imageData = content.data;
      console.log(`   🖼️  Image received: ${content.mimeType}, ${Math.round(content.data.length / 1024)}KB base64`);
    }
  }

  if (result.structuredContent) {
    console.log('\n   📦 Structured content:');
    console.log(`   - Period: ${result.structuredContent.period}`);
    console.log(`   - Date range: ${result.structuredContent.startDate} to ${result.structuredContent.endDate}`);
    if (result.structuredContent.stats) {
      const stats = result.structuredContent.stats;
      console.log(`   - Total hours: ${stats.totalHours}h`);
      console.log(`   - Categories:`);
      if (stats.categories.prod) {
        console.log(`     • Productive: ${stats.categories.prod.hours}h (${stats.categories.prod.percentage}%)`);
      }
      if (stats.categories.admin) {
        console.log(`     • Admin/Rest: ${stats.categories.admin.hours}h (${stats.categories.admin.percentage}%)`);
      }
      if (stats.categories.nonprod) {
        console.log(`     • Non-productive: ${stats.categories.nonprod.hours}h (${stats.categories.nonprod.percentage}%)`);
      }
    }
  }

  // Save image if present
  if (hasImage && imageData) {
    const outputPath = path.join(__dirname, '..', 'test-output-chart.png');
    const buffer = Buffer.from(imageData, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`\n   ✅ Chart saved to: ${outputPath}`);
    console.log(`   📂 Open with: open "${outputPath}"`);
  } else {
    console.log('\n   ⚠️  No image in response');
  }

  return { hasImage, result };
}

// Test 3: Test different chart types
async function testChartTypes() {
  console.log('\n🎨 Test 3: Testing different chart types...');
  
  const chartTypes = ['bar', 'doughnut', 'pie'];
  
  for (const chartType of chartTypes) {
    console.log(`\n   Testing ${chartType} chart...`);
    
    try {
      const result = await mcpRequest('tools/call', {
        name: 'diary.getTimeStats',
        arguments: {
          period: 'this_week',
          includeChart: true,
          chartType,
        },
      });

      const hasImage = result.content?.some(c => c.type === 'image');
      if (hasImage) {
        const imageContent = result.content.find(c => c.type === 'image');
        const outputPath = path.join(__dirname, '..', `test-output-${chartType}.png`);
        const buffer = Buffer.from(imageContent.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`   ✅ ${chartType} chart saved to: ${outputPath}`);
      } else {
        console.log(`   ⚠️  No image for ${chartType} chart`);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }
}

// Main test runner
async function main() {
  try {
    // Test 1: List tools
    const hasTimeStats = await testListTools();
    
    if (!hasTimeStats) {
      console.log('\n❌ The diary.getTimeStats tool is not available.');
      console.log('   Make sure the DiaryAnalyzer changes are deployed.\n');
      process.exit(1);
    }

    // Test 2: Get time stats for this week
    const { hasImage } = await testGetTimeStats('this_week');
    
    if (!hasImage) {
      console.log('\n⚠️  Chart generation may have failed. Check server logs.');
    }

    // Test 3: Test different chart types
    await testChartTypes();

    console.log('\n✅ All tests completed!\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

main();
