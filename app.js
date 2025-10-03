// Global variables
let currentDate = new Date();
let accessToken = null;
let allEvents = [];
let gapi = null;

// Configuration (will be loaded from config.js if available)
const CONFIG = window.CONFIG || {
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
    GOOGLE_API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
    DEBUG: true
};

// DOM elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const contentSection = document.getElementById('contentSection');
const errorSection = document.getElementById('errorSection');
const refreshBtn = document.getElementById('refreshBtn');
const retryBtn = document.getElementById('retryBtn');
const dateRange = document.getElementById('dateRange');
const viewMode = document.getElementById('viewMode');
const prevDayBtn = document.getElementById('prevDay');
const nextDayBtn = document.getElementById('nextDay');
const currentDateSpan = document.getElementById('currentDate');
const timeline = document.getElementById('timeline');
const timelineContainer = document.getElementById('timelineContainer');
const distributionContainer = document.getElementById('distributionContainer');
const distributionChart = document.getElementById('distributionChart');
const distributionStats = document.getElementById('distributionStats');
const totalEventsSpan = document.getElementById('totalEvents');
const activeHoursSpan = document.getElementById('activeHours');
const mostCommonSpan = document.getElementById('mostCommon');
const errorMessage = document.getElementById('errorMessage');

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Diary Analyzer Web App loaded!');
    
    // Initialize Google API
    await initializeGoogleAPI();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check authentication status
    await checkAuthStatus();
    
    // Update current date display
    updateCurrentDateDisplay();
});

// Initialize Google API
async function initializeGoogleAPI() {
    return new Promise((resolve) => {
        if (typeof gapi !== 'undefined') {
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: CONFIG.GOOGLE_API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
                    });
                    console.log('✅ Google API initialized');
                    resolve();
                } catch (error) {
                    console.error('❌ Error initializing Google API:', error);
                    resolve();
                }
            });
        } else {
            console.warn('⚠️ Google API not loaded');
            resolve();
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', refreshData);
    retryBtn.addEventListener('click', refreshData);
    dateRange.addEventListener('change', onDateRangeChange);
    viewMode.addEventListener('change', onViewModeChange);
    prevDayBtn.addEventListener('click', () => navigateDate(-1));
    nextDayBtn.addEventListener('click', () => navigateDate(1));
    
    // Chart mode selector for advanced analytics
    const chartModeSelector = document.getElementById('chartMode');
    if (chartModeSelector) {
        chartModeSelector.addEventListener('change', onChartModeChange);
    }
    const stackedChart = document.getElementById('stackedChart');
    if (stackedChart) {
        stackedChart.addEventListener('change', onChartModeChange);
    }
}

// Handle Google Sign-In response
function handleCredentialResponse(response) {
    console.log('🔐 Google Sign-In response received');
    
    if (response.credential) {
        // Extract the JWT token
        const token = response.credential;
        
        // For now, we'll use a simplified approach
        // In a production app, you'd verify the JWT server-side
        accessToken = token;
        
        // Store token in localStorage
        localStorage.setItem('googleToken', token);
        
        console.log('✅ Authentication successful');
        showSection('loading');
        loadCalendarData();
    } else {
        console.error('❌ Authentication failed');
        showError('Authentication failed. Please try again.');
    }
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const storedToken = localStorage.getItem('googleToken');
        console.log('🔍 Checking stored token:', !!storedToken);

        if (storedToken) {
            accessToken = storedToken;
            console.log('✅ Using stored token');
            showSection('loading');
            await loadCalendarData();
        } else {
            console.log('❌ No stored token, showing auth');
            showSection('auth');
        }
    } catch (error) {
        console.error('❌ Error checking auth status:', error);
        showSection('auth');
    }
}

// Load calendar data from Google Calendar API
async function loadCalendarData() {
    try {
        console.log('📅 Loading calendar data...');
        console.log('🔑 Access token exists:', !!accessToken);

        // Validate token
        if (!accessToken) {
            throw new Error('No access token available. Please sign in again.');
        }

        // For this demo, we'll use a mock approach since we need proper OAuth setup
        // In a real implementation, you'd use the Google Calendar API with proper OAuth
        
        // Mock data for demonstration
        allEvents = generateMockEvents();
        
        console.log(`📊 Total events loaded: ${allEvents.length}`);

        displayCurrentView();
        updateStats();
        showSection('content');
        
    } catch (error) {
        console.error('❌ Error loading calendar data:', error);
        showError(`Failed to load calendar data: ${error.message}`);
    }
}

// Generate mock events for demonstration
function generateMockEvents() {
    const today = new Date();
    const events = [];
    
    // Generate events for the past week
    for (let i = -7; i <= 0; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Generate 3-8 events per day
        const numEvents = Math.floor(Math.random() * 6) + 3;
        
        for (let j = 0; j < numEvents; j++) {
            const startHour = Math.floor(Math.random() * 12) + 8; // 8 AM to 8 PM
            const startMinute = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45
            const duration = Math.floor(Math.random() * 3) + 1; // 1-3 hours
            
            const startTime = new Date(date);
            startTime.setHours(startHour, startMinute, 0, 0);
            
            const endTime = new Date(startTime);
            endTime.setHours(startTime.getHours() + duration);
            
            const eventTypes = [
                { summary: 'Team Meeting', calendarName: 'Actual Diary - Prod' },
                { summary: 'Code Review', calendarName: 'Actual Diary - Prod' },
                { summary: 'Lunch Break', calendarName: 'Actual Diary - Admin' },
                { summary: 'Personal Time', calendarName: 'Actual Diary - Admin' },
                { summary: 'Research & Learning', calendarName: 'Actual Diary - Nonprod' },
                { summary: 'Project Planning', calendarName: 'Actual Diary - Prod' },
                { summary: 'Exercise', calendarName: 'Actual Diary - Admin' },
                { summary: 'Email & Admin', calendarName: 'Actual Diary - Admin' }
            ];
            
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            events.push({
                summary: eventType.summary,
                description: `Mock event for demonstration purposes`,
                start: {
                    dateTime: startTime.toISOString()
                },
                end: {
                    dateTime: endTime.toISOString()
                },
                calendarName: eventType.calendarName
            });
        }
    }
    
    return events.sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
}

// Helper function to get local date key (YYYY-MM-DD in local timezone)
function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Get date range start based on current selection
function getDateRangeStart() {
    const date = new Date(currentDate);
    const range = dateRange.value;

    switch (range) {
        case 'today':
            date.setHours(0, 0, 0, 0);
            break;
        case 'week':
            const dayOfWeek = date.getDay();
            const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            date.setDate(date.getDate() + diff);
            date.setHours(0, 0, 0, 0);
            break;
        case 'month':
            date.setDate(1);
            date.setHours(0, 0, 0, 0);
            break;
        case 'quarter':
            const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
            date.setMonth(quarterStartMonth, 1);
            date.setHours(0, 0, 0, 0);
            break;
        case 'year':
            date.setMonth(0, 1);
            date.setHours(0, 0, 0, 0);
            break;
    }

    return date;
}

// Get date range end based on current selection
function getDateRangeEnd() {
    const date = new Date(currentDate);
    const range = dateRange.value;

    switch (range) {
        case 'today':
            date.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const dayOfWeek = date.getDay();
            const diff = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
            date.setDate(date.getDate() + diff);
            date.setHours(23, 59, 59, 999);
            break;
        case 'month':
            date.setMonth(date.getMonth() + 1);
            date.setDate(0);
            date.setHours(23, 59, 59, 999);
            break;
        case 'quarter':
            const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
            date.setMonth(quarterStartMonth + 3, 0);
            date.setHours(23, 59, 59, 999);
            break;
        case 'year':
            date.setFullYear(date.getFullYear(), 11, 31);
            date.setHours(23, 59, 59, 999);
            break;
    }

    return date;
}

// Display timeline for current date
function displayTimeline() {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        return eventDate >= dayStart && eventDate <= dayEnd;
    });

    timeline.innerHTML = '';

    if (dayEvents.length === 0) {
        timeline.innerHTML = '<div class="no-events">No events found for this date</div>';
        return;
    }

    dayEvents.forEach(event => {
        const timelineItem = createTimelineItem(event);
        timeline.appendChild(timelineItem);
    });
}

// Create timeline item element
function createTimelineItem(event) {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const startTime = new Date(event.start.dateTime || event.start.date);
    const endTime = new Date(event.end.dateTime || event.end.date);

    const timeStr = event.start.dateTime ?
        `${formatTime(startTime)} - ${formatTime(endTime)}` :
        'All day';

    const category = categorizeEvent(event.summary);

    item.innerHTML = `
        <div class="timeline-time">${timeStr}</div>
        <div class="timeline-title">${event.summary || 'No title'}</div>
        ${event.description ? `<div class="timeline-description">${event.description}</div>` : ''}
        <div class="event-category category-${category}">${category}</div>
        ${event.calendarName ? `<div class="calendar-source">📅 ${event.calendarName}</div>` : ''}
    `;

    return item;
}

// Display distribution analysis
function displayDistribution() {
    const range = dateRange.value;

    if (range === 'today') {
        displayDailyDistribution();
    } else {
        displayStackedDistribution();
    }
}

// Display distribution for a single day
function displayDailyDistribution() {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        return eventDate >= dayStart && eventDate <= dayEnd;
    });

    // Calculate time distribution by calendar
    const calendarDistribution = calculateCalendarTimeDistribution(dayEvents);

    // Display chart
    displayDistributionChart(calendarDistribution);

    // Display stats
    displayDistributionStats(calendarDistribution);
}

// Display stacked distribution for week/month
function displayStackedDistribution() {
    const range = dateRange.value;
    const startDate = getDateRangeStart();
    const endDate = getDateRangeEnd();

    // Group events by date
    const eventsByDate = groupEventsByDate(allEvents, startDate, endDate);

    // Update header
    const subtitle = document.querySelector('.distribution-subtitle');
    if (range === 'week') {
        subtitle.textContent = 'Weekly time distribution';
    } else if (range === 'month') {
        subtitle.textContent = 'Monthly time distribution';
    } else if (range === 'quarter') {
        subtitle.textContent = 'Quarterly time distribution';
    } else if (range === 'year') {
        subtitle.textContent = 'Yearly time distribution';
    }

    // Calculate overall period distribution
    const overallDistribution = calculateOverallDistribution(eventsByDate);

    // Display overall distribution summary first
    displayOverallDistributionSummary(overallDistribution, range);

    // Display daily stacked chart
    displayStackedChart(eventsByDate);

    // Display aggregated stats
    displayAggregatedStats(eventsByDate);
}

// Group events by date for stacked visualization
function groupEventsByDate(events, startDate, endDate) {
    const eventsByDate = {};

    // Initialize all dates in range using local timezone
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateKey = getLocalDateKey(currentDate);
        eventsByDate[dateKey] = {
            date: new Date(currentDate),
            displayDate: currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            prod: 0,
            nonprod: 0,
            admin: 0,
            other: 0,
            total: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Group events by date and calculate time per calendar type
    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const eventDate = new Date(event.start.dateTime);
            const dateKey = getLocalDateKey(eventDate);

            if (eventsByDate[dateKey]) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60); // minutes

                const calendarKey = getCalendarKey(event.calendarName);
                eventsByDate[dateKey][calendarKey] += duration;
                eventsByDate[dateKey].total += duration;
            }
        }
    });

    return eventsByDate;
}

// Calculate overall distribution for entire period
function calculateOverallDistribution(eventsByDate) {
    const overall = {
        prod: 0,
        nonprod: 0,
        admin: 0,
        other: 0,
        total: 0
    };

    Object.values(eventsByDate).forEach(day => {
        overall.prod += day.prod;
        overall.nonprod += day.nonprod;
        overall.admin += day.admin;
        overall.other += day.other;
        overall.total += day.total;
    });

    // Calculate percentages
    Object.keys(overall).forEach(key => {
        if (key !== 'total') {
            overall[`${key}Percentage`] = overall.total > 0 ? (overall[key] / overall.total) * 100 : 0;
        }
    });

    return overall;
}

// Display overall distribution summary for week/month
function displayOverallDistributionSummary(overall, range) {
    const chartContainer = distributionChart;
    
    // Create overall summary section
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'overall-summary';
    let rangeTitle;
    if (range === 'week') {
        rangeTitle = 'Weekly';
    } else if (range === 'month') {
        rangeTitle = 'Monthly';
    } else if (range === 'quarter') {
        rangeTitle = 'Quarterly';
    } else if (range === 'year') {
        rangeTitle = 'Yearly';
    }
    summaryDiv.innerHTML = `
        <h4>Overall ${rangeTitle} Distribution</h4>
        <div class="overall-bars">
            <div class="overall-bar">
                <div class="overall-bar-label">🟢 Production Work</div>
                <div class="overall-bar-container">
                    <div class="overall-bar-fill bar-prod" style="width: ${Math.max(overall.prodPercentage || 0, 5)}%"></div>
                </div>
                <div class="overall-bar-time">${Math.floor((overall.prod || 0)/60)}h ${Math.floor((overall.prod || 0)%60)}m (${(overall.prodPercentage || 0).toFixed(1)}%)</div>
            </div>
            <div class="overall-bar">
                <div class="overall-bar-label">⚫ Non-Production</div>
                <div class="overall-bar-container">
                    <div class="overall-bar-fill bar-nonprod" style="width: ${Math.max(overall.nonprodPercentage || 0, 5)}%"></div>
                </div>
                <div class="overall-bar-time">${Math.floor((overall.nonprod || 0)/60)}h ${Math.floor((overall.nonprod || 0)%60)}m (${(overall.nonprodPercentage || 0).toFixed(1)}%)</div>
            </div>
            <div class="overall-bar">
                <div class="overall-bar-label">🟠 Admin & Rest</div>
                <div class="overall-bar-container">
                    <div class="overall-bar-fill bar-admin" style="width: ${Math.max(overall.adminPercentage || 0, 5)}%"></div>
                </div>
                <div class="overall-bar-time">${Math.floor((overall.admin || 0)/60)}h ${Math.floor((overall.admin || 0)%60)}m (${(overall.adminPercentage || 0).toFixed(1)}%)</div>
            </div>
            <div class="overall-bar">
                <div class="overall-bar-label">⚪ Other Activities</div>
                <div class="overall-bar-container">
                    <div class="overall-bar-fill bar-other" style="width: ${Math.max(overall.otherPercentage || 0, 5)}%"></div>
                </div>
                <div class="overall-bar-time">${Math.floor((overall.other || 0)/60)}h ${Math.floor((overall.other || 0)%60)}m (${(overall.otherPercentage || 0).toFixed(1)}%)</div>
            </div>
        </div>
        <div class="daily-breakdown-header">
            <h4>Daily Breakdown</h4>
        </div>
    `;
    
    // Clear and add summary
    chartContainer.innerHTML = '';
    chartContainer.appendChild(summaryDiv);
}

// Display stacked chart
function displayStackedChart(eventsByDate) {
    const dates = Object.keys(eventsByDate).sort();

    if (dates.length === 0) {
        const noEventsDiv = document.createElement('div');
        noEventsDiv.className = 'no-events';
        noEventsDiv.textContent = 'No events found in this date range';
        distributionChart.appendChild(noEventsDiv);
        return;
    }

    // Remove any existing daily charts container before adding a new one
    const oldDaily = distributionChart.querySelector('.daily-charts-container');
    if (oldDaily) oldDaily.remove();

    // Find max total time for scaling
    const maxTotal = Math.max(...Object.values(eventsByDate).map(day => day.total));

    if (maxTotal === 0) {
        const noEventsDiv = document.createElement('div');
        noEventsDiv.className = 'no-events';
        noEventsDiv.textContent = 'No timed events found in this date range';
        distributionChart.appendChild(noEventsDiv);
        return;
    }

    // Create container for daily stacked charts
    const dailyChartsContainer = document.createElement('div');
    dailyChartsContainer.className = 'daily-charts-container';

    dates.forEach(dateKey => {
        const dayData = eventsByDate[dateKey];

        const dayElement = document.createElement('div');
        dayElement.className = 'stacked-day';

        const totalHours = Math.floor(dayData.total / 60);
        const totalMinutes = Math.floor(dayData.total % 60);
        const totalTimeStr = totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`;

        // Calculate percentages for stacking with better visibility
        const maxBarHeight = 180;
        const prodHeight = maxTotal > 0 ? Math.max((dayData.prod / maxTotal) * maxBarHeight, dayData.prod > 0 ? 8 : 0) : 0;
        const nonprodHeight = maxTotal > 0 ? Math.max((dayData.nonprod / maxTotal) * maxBarHeight, dayData.nonprod > 0 ? 8 : 0) : 0;
        const adminHeight = maxTotal > 0 ? Math.max((dayData.admin / maxTotal) * maxBarHeight, dayData.admin > 0 ? 8 : 0) : 0;
        const otherHeight = maxTotal > 0 ? Math.max((dayData.other / maxTotal) * maxBarHeight, dayData.other > 0 ? 8 : 0) : 0;

        dayElement.innerHTML = `
            <div class="stacked-bar-container">
                <div class="stacked-bar">
                    ${dayData.prod > 0 ? `<div class="stack-segment bar-prod" style="height: ${prodHeight}px" title="Production: ${Math.floor(dayData.prod/60)}h ${Math.floor(dayData.prod%60)}m"></div>` : ''}
                    ${dayData.nonprod > 0 ? `<div class="stack-segment bar-nonprod" style="height: ${nonprodHeight}px" title="Non-Production: ${Math.floor(dayData.nonprod/60)}h ${Math.floor(dayData.nonprod%60)}m"></div>` : ''}
                    ${dayData.admin > 0 ? `<div class="stack-segment bar-admin" style="height: ${adminHeight}px" title="Admin & Rest: ${Math.floor(dayData.admin/60)}h ${Math.floor(dayData.admin%60)}m"></div>` : ''}
                    ${dayData.other > 0 ? `<div class="stack-segment bar-other" style="height: ${otherHeight}px" title="Other: ${Math.floor(dayData.other/60)}h ${Math.floor(dayData.other%60)}m"></div>` : ''}
                </div>
                <div class="stacked-time">${totalTimeStr}</div>
            </div>
            <div class="stacked-date">${dayData.displayDate}</div>
        `;

        dailyChartsContainer.appendChild(dayElement);
    });

    // Add the daily charts container to the main distribution chart, after the summary
    distributionChart.appendChild(dailyChartsContainer);
}

// Display aggregated statistics for date range
function displayAggregatedStats(eventsByDate) {
    distributionStats.innerHTML = '';

    // Calculate totals across all dates
    const totals = {
        prod: 0,
        nonprod: 0,
        admin: 0,
        other: 0,
        total: 0
    };

    Object.values(eventsByDate).forEach(day => {
        totals.prod += day.prod;
        totals.nonprod += day.nonprod;
        totals.admin += day.admin;
        totals.other += day.other;
        totals.total += day.total;
    });

    // Total time stat
    const totalHours = Math.floor(totals.total / 60);
    const totalMinutes = Math.floor(totals.total % 60);
    const totalTimeStr = totalHours > 0 ?
        `${totalHours}h ${totalMinutes}m` :
        `${totalMinutes}m`;

    const totalStat = document.createElement('div');
    totalStat.className = 'distribution-stat';
    totalStat.innerHTML = `
        <span class="distribution-stat-label">Total Time</span>
        <span class="distribution-stat-value">${totalTimeStr}</span>
    `;
    distributionStats.appendChild(totalStat);

    // Individual category stats
    const categories = [
        { key: 'prod', name: 'Production' },
        { key: 'nonprod', name: 'Non-Production' },
        { key: 'admin', name: 'Admin & Rest' }
    ];

    categories.forEach(category => {
        if (totals[category.key] > 0) {
            const hours = Math.floor(totals[category.key] / 60);
            const minutes = Math.floor(totals[category.key] % 60);
            const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

            const stat = document.createElement('div');
            stat.className = 'distribution-stat';
            stat.innerHTML = `
                <span class="distribution-stat-label">${category.name}</span>
                <span class="distribution-stat-value">${timeStr}</span>
            `;
            distributionStats.appendChild(stat);
        }
    });
}

// Calculate time spent per calendar
function calculateCalendarTimeDistribution(events) {
    const distribution = {};
    let totalMinutes = 0;

    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const duration = (end - start) / (1000 * 60); // minutes

            const calendarKey = getCalendarKey(event.calendarName);

            if (!distribution[calendarKey]) {
                distribution[calendarKey] = {
                    name: calendarKey,
                    displayName: getCalendarDisplayName(calendarKey),
                    minutes: 0,
                    events: 0,
                    color: getCalendarColor(calendarKey)
                };
            }

            distribution[calendarKey].minutes += duration;
            distribution[calendarKey].events += 1;
            totalMinutes += duration;
        }
    });

    // Calculate percentages
    Object.values(distribution).forEach(calendar => {
        calendar.percentage = totalMinutes > 0 ? (calendar.minutes / totalMinutes) * 100 : 0;
        calendar.hours = Math.floor(calendar.minutes / 60);
        calendar.remainingMinutes = Math.floor(calendar.minutes % 60);
    });

    return { distribution, totalMinutes };
}

// Get calendar key for grouping
function getCalendarKey(calendarName) {
    if (!calendarName) return 'other';

    const name = calendarName.toLowerCase();
    if (name.includes('prod') && !name.includes('nonprod')) return 'prod';
    if (name.includes('nonprod')) return 'nonprod';
    if (name.includes('admin') || name.includes('rest') || name.includes('routine')) return 'admin';
    return 'other';
}

// Get display name for calendar
function getCalendarDisplayName(key) {
    const names = {
        'prod': 'Production Work',
        'nonprod': 'Non-Production',
        'admin': 'Admin & Rest',
        'other': 'Other Activities'
    };
    return names[key] || key;
}

// Get color for calendar
function getCalendarColor(key) {
    const colors = {
        'prod': 'bar-prod',
        'nonprod': 'bar-nonprod',
        'admin': 'bar-admin',
        'other': 'bar-other'
    };
    return colors[key] || 'bar-other';
}

// Display distribution chart
function displayDistributionChart(calendarData) {
    const { distribution, totalMinutes } = calendarData;

    distributionChart.innerHTML = '';

    if (totalMinutes === 0) {
        distributionChart.innerHTML = '<div class="no-events">No timed events found for this date</div>';
        return;
    }

    // Sort by time spent (descending)
    const sortedCalendars = Object.values(distribution).sort((a, b) => b.minutes - a.minutes);

    sortedCalendars.forEach(calendar => {
        const barElement = document.createElement('div');
        barElement.className = 'calendar-bar';

        const timeStr = calendar.hours > 0 ?
            `${calendar.hours}h ${calendar.remainingMinutes}m` :
            `${calendar.remainingMinutes}m`;

        const minWidth = calendar.percentage > 0 ? Math.max(calendar.percentage, 5) : 0;

        barElement.innerHTML = `
            <div class="calendar-label">${calendar.displayName}</div>
            <div class="calendar-bar-container">
                <div class="calendar-bar-fill ${calendar.color}" style="width: ${minWidth}%"></div>
            </div>
            <div class="calendar-time">${timeStr}</div>
        `;

        distributionChart.appendChild(barElement);
    });
}

// Display distribution statistics
function displayDistributionStats(calendarData) {
    const { distribution, totalMinutes } = calendarData;

    distributionStats.innerHTML = '';

    // Total time stat
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = Math.floor(totalMinutes % 60);
    const totalTimeStr = totalHours > 0 ?
        `${totalHours}h ${totalRemainingMinutes}m` :
        `${totalRemainingMinutes}m`;

    const totalStat = document.createElement('div');
    totalStat.className = 'distribution-stat';
    totalStat.innerHTML = `
        <span class="distribution-stat-label">Total Time</span>
        <span class="distribution-stat-value">${totalTimeStr}</span>
    `;
    distributionStats.appendChild(totalStat);

    // Individual calendar stats
    const sortedCalendars = Object.values(distribution).sort((a, b) => b.minutes - a.minutes);

    sortedCalendars.slice(0, 3).forEach(calendar => {
        const stat = document.createElement('div');
        stat.className = 'distribution-stat';

        const timeStr = calendar.hours > 0 ?
            `${calendar.hours}h ${calendar.remainingMinutes}m` :
            `${calendar.remainingMinutes}m`;

        stat.innerHTML = `
            <span class="distribution-stat-label">${calendar.displayName}</span>
            <span class="distribution-stat-value">${timeStr}</span>
        `;
        distributionStats.appendChild(stat);
    });
}

// Categorize event based on title
function categorizeEvent(title) {
    if (!title) return 'other';

    const titleLower = title.toLowerCase();

    if (titleLower.includes('meeting') || titleLower.includes('call') || titleLower.includes('interview')) {
        return 'meeting';
    }
    if (titleLower.includes('breakfast') || titleLower.includes('lunch') || titleLower.includes('dinner') || titleLower.includes('eat')) {
        return 'food';
    }
    if (titleLower.includes('rest') || titleLower.includes('sleep') || titleLower.includes('nap') || titleLower.includes('relax')) {
        return 'rest';
    }
    if (titleLower.includes('code') || titleLower.includes('work') || titleLower.includes('project') || titleLower.includes('dev')) {
        return 'work';
    }
    if (titleLower.includes('shower') || titleLower.includes('walk') || titleLower.includes('personal') || titleLower.includes('exercise')) {
        return 'personal';
    }

    return 'other';
}

// Format time for display
function formatTime(date) {
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

// Update statistics
function updateStats() {
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        return eventDate >= dayStart && eventDate <= dayEnd;
    });

    // Total events
    totalEventsSpan.textContent = dayEvents.length;

    // Active hours calculation
    let totalMinutes = 0;
    dayEvents.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            totalMinutes += (end - start) / (1000 * 60);
        }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    activeHoursSpan.textContent = `${hours}h ${minutes}m`;

    // Most common activity
    const categories = {};
    dayEvents.forEach(event => {
        const category = categorizeEvent(event.summary);
        categories[category] = (categories[category] || 0) + 1;
    });

    const categoryEntries = Object.entries(categories);
    let mostCommon = null;

    if (categoryEntries.length > 0) {
        mostCommon = categoryEntries.reduce((a, b) =>
            categories[a[0]] > categories[b[0]] ? a : b
        );
    }

    mostCommonSpan.textContent = mostCommon ? mostCommon[0] : '-';
}

// Navigate to previous/next date
function navigateDate(direction) {
    const range = dateRange.value;
    const newDate = new Date(currentDate);

    switch (range) {
        case 'today':
            newDate.setDate(newDate.getDate() + direction);
            break;
        case 'week':
            newDate.setDate(newDate.getDate() + 7 * direction);
            break;
        case 'month':
            newDate.setMonth(newDate.getMonth() + direction);
            break;
        case 'quarter':
            newDate.setMonth(newDate.getMonth() + 3 * direction);
            break;
        case 'year':
            newDate.setFullYear(newDate.getFullYear() + direction);
            break;
    }

    currentDate = newDate;
    updateCurrentDateDisplay();

    // Reload data for new date range
    if (accessToken) {
        showSection('loading');
        loadCalendarData();
    }
}

// Update current date display
function updateCurrentDateDisplay() {
    const range = dateRange.value;
    let displayString = '';

    if (range === 'today') {
        displayString = currentDate.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
        });
    } else if (range === 'year') {
        const year = currentDate.getFullYear();
        displayString = `${year}`;
    } else if (range === 'quarter') {
        const quarter = Math.floor(currentDate.getMonth() / 3) + 1;
        const year = currentDate.getFullYear();
        displayString = `Q${quarter} ${year}`;
    } else {
        const startDate = getDateRangeStart();
        const endDate = getDateRangeEnd();

        const startStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const endStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

        displayString = `${startStr} - ${endStr}`;
    }

    currentDateSpan.textContent = displayString;
}

// Handle date range change
function onDateRangeChange() {
    if (accessToken) {
        showSection('loading');
        loadCalendarData();
    }
}

// Handle view mode change
function onViewModeChange() {
    displayCurrentView();
}

// Handle chart mode change
function onChartModeChange() {
    displayAdvancedAnalytics();
}

// Display current view based on selected mode
function displayCurrentView() {
    const selectedView = viewMode.value;

    timelineContainer.classList.add('hidden');
    distributionContainer.classList.add('hidden');
    document.getElementById('advancedContainer').classList.add('hidden');

    if (selectedView === 'timeline') {
        timelineContainer.classList.remove('hidden');
        displayTimeline();
    } else if (selectedView === 'distribution') {
        distributionContainer.classList.remove('hidden');
        displayDistribution();
    } else if (selectedView === 'advanced') {
        document.getElementById('advancedContainer').classList.remove('hidden');
        displayAdvancedAnalytics();
    }
}

// Display advanced analytics (simplified version)
function displayAdvancedAnalytics() {
    console.log('📊 Displaying advanced analytics...');
    // For now, just show a placeholder
    const advancedCharts = document.getElementById('advancedCharts');
    advancedCharts.innerHTML = '<div class="no-events">Advanced analytics coming soon!</div>';
}

// Refresh data
async function refreshData() {
    if (accessToken) {
        showSection('loading');
        await loadCalendarData();
    } else {
        showSection('auth');
    }
}

// Show specific section
function showSection(section) {
    authSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    contentSection.classList.add('hidden');
    errorSection.classList.add('hidden');

    switch (section) {
        case 'auth':
            authSection.classList.remove('hidden');
            break;
        case 'loading':
            loadingSection.classList.remove('hidden');
            break;
        case 'content':
            contentSection.classList.remove('hidden');
            break;
        case 'error':
            errorSection.classList.remove('hidden');
            break;
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
}

// Add CSS for no events message
const style = document.createElement('style');
style.textContent = `
    .no-events {
        text-align: center;
        color: #666;
        padding: 40px 20px;
        font-style: italic;
    }
`;
document.head.appendChild(style);