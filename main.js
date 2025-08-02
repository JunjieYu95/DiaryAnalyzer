// DOM elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const contentSection = document.getElementById('contentSection');
const errorSection = document.getElementById('errorSection');
const authBtn = document.getElementById('authBtn');
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

// Global variables
let currentDate = new Date();
let accessToken = null;
let allEvents = [];

// Helper function to get local date key (YYYY-MM-DD in local timezone)
function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Initialize the extension
// Attach event listeners first so UI buttons (especially "Connect Calendar") respond immediately
// even while asynchronous authentication checks are still running.
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkAuthStatus();
    updateCurrentDateDisplay();
});

// Setup event listeners
function setupEventListeners() {
    authBtn.addEventListener('click', authenticateUser);
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
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const result = await chrome.storage.local.get(['accessToken']);
        console.log('Stored token check:', !!result.accessToken);
        console.log('Stored token type:', typeof result.accessToken);

        if (result.accessToken && typeof result.accessToken === 'string') {
            accessToken = result.accessToken;
            console.log('Using stored token');
            showSection('loading');
            await loadCalendarData();
        } else {
            console.log('No valid stored token, showing auth');
            showSection('auth');
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showSection('auth');
    }
}

// Authenticate user with Google Calendar
async function authenticateUser() {
    try {
        console.log('Starting authentication...');
        console.log('Using Client ID from manifest.json');
        const token = await chrome.identity.getAuthToken({interactive: true});
        console.log('Raw token response:', token);
        console.log('Token type:', typeof token);

        let actualToken = null;

        // Handle different token response formats
        if (typeof token === 'string') {
            // Old format: token is a string
            actualToken = token;
            console.log('Using string token format');
        } else if (typeof token === 'object' && token) {
            // New format: token is an object with token property
            if (token.error) {
                throw new Error(`OAuth Error: ${token.error} - ${token.error_description || 'Unknown error'}`);
            } else if (token.token) {
                actualToken = token.token;
                console.log('Using object token format');
                console.log('Granted scopes:', token.grantedScopes);
            } else {
                throw new Error(`Unexpected token format: ${JSON.stringify(token)}`);
            }
        }

        console.log('Actual token length:', actualToken ? actualToken.length : 'N/A');
        console.log('Token starts with:', actualToken ? actualToken.substring(0, 20) : 'N/A');
        console.log('Token received:', actualToken ? 'SUCCESS' : 'FAILED');

        if (actualToken && typeof actualToken === 'string' && actualToken.length > 0) {
            accessToken = actualToken;
            await chrome.storage.local.set({accessToken: actualToken});
            console.log('Token stored successfully');
            showSection('loading');
            await loadCalendarData();
        } else {
            showError('No valid token received. Check OAuth configuration.');
        }
    } catch (error) {
        console.error('Authentication error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // More specific error messages
        if (error.message.includes('OAuth2')) {
            showError('OAuth2 configuration error. Check your Client ID in manifest.json');
        } else if (error.message.includes('Authorization')) {
            showError('Authorization failed. Check Google Cloud Console settings.');
        } else {
            showError(`Authentication failed: ${error.message}`);
        }
    }
}

// Load calendar data from Google Calendar API
async function loadCalendarData() {
    try {
        console.log('Loading calendar data...');
        console.log('Access token exists:', !!accessToken);
        console.log('Access token type:', typeof accessToken);
        console.log('Token preview:', typeof accessToken === 'string' ? accessToken.substring(0, 20) + '...' : accessToken);

        // Validate token
        if (!accessToken || typeof accessToken !== 'string') {
            throw new Error('Invalid access token. Please re-authenticate.');
        }

        // First, get list of all calendars
        console.log('Fetching calendar list...');
        const calendarListResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!calendarListResponse.ok) {
            throw new Error(`Failed to fetch calendars: ${calendarListResponse.status}`);
        }

        const calendarList = await calendarListResponse.json();
        console.log('Available calendars:', calendarList.items?.map(cal => cal.summary));

        // Filter for relevant calendars (primary + diary calendars)
        const relevantCalendars = calendarList.items?.filter(calendar =>
            calendar.id === 'primary' ||
            calendar.summary?.toLowerCase().includes('diary') ||
            calendar.summary?.toLowerCase().includes('actual')
        ) || [];

        console.log('Relevant calendars:', relevantCalendars.map(cal => cal.summary));

        const timeMin = getDateRangeStart();
        const timeMax = getDateRangeEnd();

        // Fetch events from all relevant calendars
        allEvents = [];

        for (const calendar of relevantCalendars) {
            console.log(`Fetching events from: ${calendar.summary}`);

            const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                `timeMin=${timeMin.toISOString()}&` +
                `timeMax=${timeMax.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime&` +
                `maxResults=2500`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const events = data.items || [];
                console.log(`Found ${events.length} events in ${calendar.summary}`);

                // Add calendar name to each event for reference
                events.forEach(event => {
                    event.calendarName = calendar.summary;
                });

                allEvents = allEvents.concat(events);
            } else {
                console.warn(`Failed to fetch events from ${calendar.summary}: ${response.status}`);
            }
        }

        // Sort all events by start time
        allEvents.sort((a, b) => {
            const aTime = new Date(a.start.dateTime || a.start.date);
            const bTime = new Date(b.start.dateTime || b.start.date);
            return aTime - bTime;
        });

        console.log(`Total events loaded: ${allEvents.length}`);

        // Debug timezone information
        const now = new Date();
        console.log('Current local time:', now.toLocaleString());
        console.log('Current local date key:', getLocalDateKey(now));
        console.log('User timezone offset (minutes):', now.getTimezoneOffset());
        console.log('Date range start:', getDateRangeStart().toLocaleString());
        console.log('Date range end:', getDateRangeEnd().toLocaleString());

        displayCurrentView();
        updateStats();
        showSection('content');
    } catch (error) {
        console.error('Error loading calendar data:', error);
        if (error.message.includes('401')) {
            console.log('401 error - token might be expired, trying to refresh...');
            // Try to get a fresh token
            try {
                const newToken = await chrome.identity.getAuthToken({interactive: false});
                if (newToken && newToken !== accessToken) {
                    console.log('Got fresh token, retrying...');
                    accessToken = newToken;
                    await chrome.storage.local.set({accessToken: newToken});
                    // Retry the API call
                    await loadCalendarData();
                    return;
                }
            } catch (refreshError) {
                console.log('Token refresh failed:', refreshError);
            }

            // If refresh failed, clear token and re-authenticate
            await chrome.storage.local.remove(['accessToken']);
            accessToken = null;
            showError('Session expired. Please reconnect your calendar.');
            setTimeout(() => showSection('auth'), 2000);
        } else {
            showError(`Failed to load calendar data: ${error.message}`);
        }
    }
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
    console.log('🗓️ groupEventsByDate called:', { 
        startDate: startDate?.toISOString(), 
        endDate: endDate?.toISOString(),
        eventsCount: events?.length 
    });
    
    // Safety checks to prevent infinite loops
    if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date)) {
        console.error('❌ Invalid date parameters:', { startDate, endDate });
        return {};
    }
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('❌ Invalid date values:', { startDate, endDate });
        return {};
    }
    
    if (startDate > endDate) {
        console.error('❌ Start date is after end date:', { startDate, endDate });
        return {};
    }
    
    // Limit to reasonable date range (max 1 year)
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
        console.error('❌ Date range too large:', daysDiff, 'days');
        return {};
    }
    
    const eventsByDate = {};
    let loopCount = 0;
    const MAX_ITERATIONS = 400; // Safety limit

    // Initialize all dates in range using local timezone
    const currentDate = new Date(startDate);
    while (currentDate <= endDate && loopCount < MAX_ITERATIONS) {
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
        loopCount++;
    }
    
    if (loopCount >= MAX_ITERATIONS) {
        console.error('❌ Loop limit reached in groupEventsByDate');
        return {};
    }
    
    console.log('✅ Date range initialized:', Object.keys(eventsByDate).length, 'days');

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
    // Do not clear distributionChart.innerHTML here as it contains the overall summary!
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
        const maxBarHeight = 180; // Reserve 20px for spacing at top
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

        const minWidth = calendar.percentage > 0 ? Math.max(calendar.percentage, 5) : 0; // Minimum 5% width for visibility

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

    sortedCalendars.slice(0, 3).forEach(calendar => { // Show top 3
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

// Categorize event based on title (legacy function, kept for compatibility)
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

    // Debug: log current date info
    console.log('Current date display:', displayString);
    console.log('Current date key:', getLocalDateKey(currentDate));
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

function stopAllCharts() {
    console.log('🛑 Stopping all charts...');
    
    // Destroy and nullify all charts
    if (window.timeSeriesChart) {
        try {
            window.timeSeriesChart.destroy();
        } catch (e) {}
        window.timeSeriesChart = null;
    }
    
    if (window.categoryChart) {
        try {
            window.categoryChart.destroy();
        } catch (e) {}
        window.categoryChart = null;
    }
    
    // Clear canvases manually
    const timeSeriesCtx = document.getElementById('timeSeriesChart')?.getContext('2d');
    const categoryCtx = document.getElementById('categoryChart')?.getContext('2d');
    
    if (timeSeriesCtx) {
        timeSeriesCtx.clearRect(0, 0, timeSeriesCtx.canvas.width, timeSeriesCtx.canvas.height);
    }
    if (categoryCtx) {
        categoryCtx.clearRect(0, 0, categoryCtx.canvas.width, categoryCtx.canvas.height);
    }
    
    console.log('✅ All charts stopped');
}

function onChartModeChange() {
    const chartMode = document.getElementById('chartMode').value;
    console.log('📊 Chart mode changed to:', chartMode);
    
    // Stop all existing charts first
    stopAllCharts();
    
    // Wait a bit then display new charts
    setTimeout(() => {
        displayAdvancedAnalytics();
    }, 200);
}

// Prevent multiple simultaneous calls
let isDisplayingAnalytics = false;

// Globally disable all Chart.js animations and responsive behavior
if (typeof Chart !== 'undefined') {
    Chart.defaults.animation = false;
    Chart.defaults.animations = false;
    Chart.defaults.responsive = false;
    Chart.defaults.interaction.intersect = false;
    Chart.defaults.hover.mode = null;
}

function displayAdvancedAnalytics() {
    if (isDisplayingAnalytics) {
        console.log('⚠️ displayAdvancedAnalytics already running, skipping...');
        return;
    }
    
    isDisplayingAnalytics = true;
    console.log('🚀 Starting displayAdvancedAnalytics...');
    
    try {
        const chartMode = document.getElementById('chartMode')?.value || 'daily-totals';
        
        if (chartMode === 'timeline-flow') {
            displayTimelineFlow();
        } else {
            displayDailyTotals();
        }
    } catch (error) {
        console.error('❌ Error in displayAdvancedAnalytics:', error);
    } finally {
        isDisplayingAnalytics = false;
        console.log('✅ displayAdvancedAnalytics completed');
    }
}

function displayDailyTotals() {
    console.log('📊 Starting displayDailyTotals...');
    
    // Clean up timeline mode artifacts
    const chartContainer = document.getElementById('advancedCharts');
    const existingLegend = chartContainer.querySelector('.timeline-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    // Ensure proper canvas sizing and visibility - only show time series chart
    const timeSeriesCanvas = document.getElementById('timeSeriesChart');
    const categoryCanvas = document.getElementById('categoryChart');
    
    if (!timeSeriesCanvas || !categoryCanvas) {
        console.error('❌ Required canvas elements not found');
        return;
    }
    
    // Set explicit canvas dimensions (not responsive to prevent loops)
    timeSeriesCanvas.width = 800;
    timeSeriesCanvas.height = 400;
    timeSeriesCanvas.style.width = '100%';
    timeSeriesCanvas.style.height = '400px';
    timeSeriesCanvas.style.display = 'block';
    
    // Hide the category chart since it's redundant with the distribution view
    categoryCanvas.style.display = 'none';
    
    const startDate = getDateRangeStart();
    const endDate = getDateRangeEnd();
    
    // Safety check for valid dates
    if (!startDate || !endDate) {
        console.error('❌ Invalid date range for displayDailyTotals');
        return;
    }
    
    const eventsByDate = groupEventsByDate(allEvents, startDate, endDate);
    
    // Check if groupEventsByDate returned empty due to error
    if (!eventsByDate || Object.keys(eventsByDate).length === 0) {
        console.error('❌ No events by date returned, skipping chart creation');
        return;
    }

    // Enhanced time series chart showing category transitions over time
    const timeSeriesLabels = Object.keys(eventsByDate).sort();
    const categoryTimeData = calculateCategoryTimeSeriesData(allEvents, timeSeriesLabels);
    
    console.log('📅 Time series labels:', timeSeriesLabels);
    console.log('📊 Events to process:', allEvents.length);
    
    const categoryColors = {
        'prod': 'rgba(76, 175, 80, 0.8)',      // Green - Production Work
        'nonprod': 'rgba(117, 117, 117, 0.8)', // Grey - Non-Production  
        'admin': 'rgba(255, 152, 0, 0.8)',     // Orange - Admin & Rest
        'other': 'rgba(189, 189, 189, 0.8)'    // Light Grey - Other Activities
    };

    const timeSeriesDatasets = Object.keys(categoryColors).map(category => {
        const data = timeSeriesLabels.map(date => {
            const minutes = categoryTimeData[date] ? categoryTimeData[date][category] || 0 : 0;
            return minutes / 60; // Convert to hours
        });
        
        console.log(`📈 ${category} data:`, data);
        
        return {
            label: getCategoryDisplayName(category),
            data: data,
            borderColor: categoryColors[category],
            backgroundColor: categoryColors[category].replace('0.8', '0.3'),
            fill: true,
            tension: 0.4
        };
    });

    const timeSeriesCtx = document.getElementById('timeSeriesChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.timeSeriesChart && typeof window.timeSeriesChart.destroy === 'function') {
        window.timeSeriesChart.destroy();
    }
    
            try {
            window.timeSeriesChart = new Chart(timeSeriesCtx, {
                type: 'line',
                data: {
                    labels: timeSeriesLabels.map(date => eventsByDate[date].displayDate),
                    datasets: timeSeriesDatasets
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    animation: false,
                    animations: false,
                    transitions: {
                        active: { animation: { duration: 0 } },
                        resize: { animation: { duration: 0 } },
                        show: { animation: { duration: 0 } },
                        hide: { animation: { duration: 0 } }
                    },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Category Time Series - How You Shift Between Activities',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const hours = context.parsed.y.toFixed(1);
                            return `${context.dataset.label}: ${hours}h`;
                        },
                        footer: function(tooltipItems) {
                            const total = tooltipItems.reduce((sum, item) => sum + item.parsed.y, 0);
                            return `Total: ${total.toFixed(1)}h`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Hours per Day',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    beginAtZero: true,
                    grid: {
                        display: true,
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                }
            }
        }
    });
    } catch (error) {
        console.error('Error creating time series chart:', error);
        // Set a fallback so destroy works later
        window.timeSeriesChart = { destroy: () => {} };
    }

    // Skip creating the category chart since it's redundant with the distribution view
    // Just ensure any existing category chart is destroyed
    if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
        window.categoryChart.destroy();
        window.categoryChart = null;
    }
    
    console.log('✅ displayAdvancedAnalytics completed successfully');
}

function displayTimelineFlow() {
    console.log('🕒 Starting timeline flow visualization...');
    
    // Get the current date range from UI
    const startDate = getDateRangeStart();
    const endDate = getDateRangeEnd();
    
    // Safety check for date variables
    if (!startDate || !endDate) {
        console.error('❌ Invalid date range for timeline');
        displayEmptyTimeline();
        return;
    }
    
    console.log('📅 Timeline date range:', startDate.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
    
    // Show timeline chart and hide category chart
    const timeSeriesCanvas = document.getElementById('timeSeriesChart');
    const categoryCanvas = document.getElementById('categoryChart');
    
    if (!timeSeriesCanvas || !categoryCanvas) {
        console.error('❌ Required canvas elements not found');
        return;
    }
    
    timeSeriesCanvas.style.display = 'block';
    categoryCanvas.style.display = 'none';
    
    // Ensure proper canvas sizing (not responsive to prevent loops)
    timeSeriesCanvas.width = 800;
    timeSeriesCanvas.height = 400;
    timeSeriesCanvas.style.width = '100%';
    timeSeriesCanvas.style.height = '400px';
    
    // Filter events for the selected date range
    const rangeEvents = allEvents.filter(event => {
        if (!event.start.dateTime || !event.end.dateTime) return false;
        const eventDate = new Date(event.start.dateTime);
        return eventDate >= startDate && eventDate <= endDate;
    }).sort((a, b) => new Date(a.start.dateTime) - new Date(b.start.dateTime));
    
    console.log(`📅 Processing ${rangeEvents.length} events for timeline from ${startDate.toDateString()} to ${endDate.toDateString()}`);
    
    if (rangeEvents.length === 0) {
        displayEmptyTimeline();
        return;
    }
    
    // Process events into timeline data with multi-day X-axis
    const timelineData = rangeEvents.map(event => {
        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);
        const category = getCalendarKey(event.calendarName);
        
        // Calculate minutes from the start date (not midnight of each day)
        const startMinutesFromRange = Math.floor((startTime - startDate) / (1000 * 60));
        const endMinutesFromRange = Math.floor((endTime - startDate) / (1000 * 60));
        
        return {
            title: event.summary || 'Untitled Event',
            category: category,
            categoryLevel: getCategoryLevel(category),
            startTime: startTime,
            endTime: endTime,
            startMinutes: startMinutesFromRange,
            endMinutes: endMinutesFromRange,
            duration: (endTime - startTime) / (1000 * 60), // minutes
            color: getCategoryColor(category)
        };
    });
    
    console.log('📊 Timeline data processed:', timelineData);
    
    // Create timeline visualization
    createTimelineChart(timelineData, startDate, endDate);
}

function getCategoryLevel(category) {
    // Map categories to discrete Y-axis levels
    const levels = {
        'prod': 3,
        'nonprod': 2, 
        'admin': 1,
        'other': 0
    };
    return levels[category] || 0;
}

function getMinutesFromMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
}

function createTimelineChart(timelineData, startDate, endDate) {
    const timeSeriesCtx = document.getElementById('timeSeriesChart').getContext('2d');
    const categoryCanvas = document.getElementById('categoryChart');
    
    // Destroy existing charts
    if (window.timeSeriesChart && typeof window.timeSeriesChart.destroy === 'function') {
        window.timeSeriesChart.destroy();
    }
    if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
        window.categoryChart.destroy();
    }
    
    // Create custom timeline visualization
    try {
        // Create a simple chart with timeline bars drawn using canvas directly
        window.timeSeriesChart = new Chart(timeSeriesCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Timeline Events',
                    data: [], // Empty data - we'll draw manually
                    backgroundColor: 'transparent'
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                animation: false,
                animations: false,
                interaction: { intersect: false, mode: null },
                hover: { mode: null },
                transitions: {
                    active: { animation: { duration: 0 } },
                    resize: { animation: { duration: 0 } },
                    show: { animation: { duration: 0 } },
                    hide: { animation: { duration: 0 } }
                },
                plugins: {
                    title: {
                        display: true,
                        text: (() => {
                            if (startDate.toDateString() === endDate.toDateString()) {
                                return `Activity Timeline - ${startDate.toDateString()}`;
                            } else {
                                return `Activity Timeline - ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                            }
                        })(),
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: {
                            display: true,
                            text: (() => {
                                const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                const numDays = Math.max(1, daysDifference);
                                return numDays === 1 ? 'Time of Day' : `Time (${numDays} days)`;
                            })()
                        },
                        min: timelineData.length > 0 ? Math.max(0, Math.min(...timelineData.map(d => d.startMinutes)) - 60) : 0,
                        max: (() => {
                            const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                            const numDays = Math.max(1, daysDifference); // At least 1 day
                            
                            if (numDays === 1) {
                                // Single day: show just 24 hours (1440 minutes)
                                return 1440;
                            } else {
                                // Multi-day: calculate actual range duration
                                const rangeDurationMinutes = Math.ceil((endDate - startDate) / (1000 * 60)) + 1440; // Add 24h buffer for multi-day
                                return timelineData.length > 0 ? 
                                    Math.max(rangeDurationMinutes, Math.max(...timelineData.map(d => d.endMinutes)) + 60) : 
                                    rangeDurationMinutes;
                            }
                        })(),
                        ticks: {
                            stepSize: (() => {
                                const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                const numDays = Math.max(1, daysDifference);
                                return numDays === 1 ? 60 : 360; // 1 hour for single day, 6 hours for multi-day
                            })(),
                            callback: function(value) {
                                const totalMinutes = value;
                                const days = Math.floor(totalMinutes / 1440);
                                const remainingMinutes = totalMinutes % 1440;
                                const hours = Math.floor(remainingMinutes / 60);
                                const minutes = remainingMinutes % 60;
                                
                                const daysDifference = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                                const numDays = Math.max(1, daysDifference);
                                
                                if (numDays === 1) {
                                    // Single day: show time only
                                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                                } else {
                                    // Multi-day: show day + time
                                    const date = new Date(startDate.getTime() + totalMinutes * 60 * 1000);
                                    return date.toLocaleDateString('en-US', { 
                                        weekday: 'short', 
                                        month: 'numeric', 
                                        day: 'numeric',
                                        hour: '2-digit'
                                    });
                                }
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Activity Category'
                        },
                        min: -0.5,
                        max: 3.5,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                const labels = {
                                    0: 'Other',
                                    1: 'Admin & Rest',
                                    2: 'Non-Production',
                                    3: 'Production Work'
                                };
                                return labels[value] || '';
                            }
                        }
                    }
                }
            }
        });
        
        // Draw timeline bars after chart is completely ready
        setTimeout(() => {
            try {
                if (window.timeSeriesChart && 
                    window.timeSeriesChart.chartArea && 
                    window.timeSeriesChart.scales &&
                    !isDisplayingAnalytics) {
                    drawTimelineBars(timeSeriesCtx, window.timeSeriesChart.chartArea, window.timeSeriesChart.scales, timelineData);
                }
            } catch (error) {
                console.error('Error drawing timeline bars:', error);
            }
        }, 500);
        
        // Create custom legend and hide category chart
        createTimelineLegend();
        categoryCanvas.style.display = 'none';
        
    } catch (error) {
        console.error('Error creating timeline chart:', error);
        window.timeSeriesChart = { destroy: () => {} };
    }
}

function drawTimelineBars(ctx, chartArea, scales, timelineData) {
    // Safety checks to prevent infinite loops
    if (!ctx || !chartArea || !scales || !timelineData || timelineData.length === 0) {
        console.log('⚠️ Skipping timeline bars - missing required data');
        return;
    }
    
    if (!scales.x || !scales.y || typeof scales.x.getPixelForValue !== 'function') {
        console.log('⚠️ Skipping timeline bars - scales not ready');
        return;
    }
    
    console.log('🎨 Drawing timeline bars for', timelineData.length, 'events');
    
    const categoryColors = {
        'prod': '#4CAF50',
        'nonprod': '#757575',
        'admin': '#FF9800',
        'other': '#BDBDBD'
    };
    
    ctx.save();
    
    timelineData.forEach((event, index) => {
        try {
            // Convert time to pixel coordinates
            const startX = scales.x.getPixelForValue(event.startMinutes);
            const endX = scales.x.getPixelForValue(event.endMinutes);
            const centerY = scales.y.getPixelForValue(event.categoryLevel);
            
            // Safety check for valid coordinates
            if (isNaN(startX) || isNaN(endX) || isNaN(centerY)) {
                console.warn(`⚠️ Invalid coordinates for event ${index}:`, {startX, endX, centerY});
                return;
            }
            
            // Calculate bar dimensions
            const barWidth = Math.max(0, endX - startX);
            const barHeight = 20;
            const barY = centerY - barHeight / 2;
            
            // Only draw if bar has positive width and is within chart area
            if (barWidth > 0 && startX < chartArea.right && endX > chartArea.left) {
                // Draw the bar
                ctx.fillStyle = categoryColors[event.category] || '#BDBDBD';
                ctx.fillRect(startX, barY, barWidth, barHeight);
                
                // Draw border
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.strokeRect(startX, barY, barWidth, barHeight);
                
                // Add text if bar is wide enough
                if (barWidth > 50) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    
                    const text = event.title && event.title.length > 15 
                        ? event.title.substring(0, 12) + '...' 
                        : event.title || 'Event';
                    ctx.fillText(text, startX + barWidth / 2, centerY);
                }
            }
        } catch (error) {
            console.error(`Error drawing event ${index}:`, error);
        }
    });
    
    ctx.restore();
    console.log('✅ Timeline bars drawing completed');
}

function createTimelineLegend() {
    // Create a simple legend below the chart
    const chartContainer = document.getElementById('advancedCharts');
    
    // Remove existing legend
    const existingLegend = chartContainer.querySelector('.timeline-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    const legend = document.createElement('div');
    legend.className = 'timeline-legend';
    legend.innerHTML = `
        <div class="legend-item"><span class="legend-color" style="background-color: #4CAF50;"></span> Production Work</div>
        <div class="legend-item"><span class="legend-color" style="background-color: #757575;"></span> Non-Production</div>
        <div class="legend-item"><span class="legend-color" style="background-color: #FF9800;"></span> Admin & Rest</div>
        <div class="legend-item"><span class="legend-color" style="background-color: #BDBDBD;"></span> Other Activities</div>
    `;
    
    chartContainer.appendChild(legend);
}

// Legacy function - removed since we're using custom timeline drawing

function formatTimeOnly(date) {
    return date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

function displayEmptyTimeline() {
    const timeSeriesCanvas = document.getElementById('timeSeriesChart');
    const categoryCanvas = document.getElementById('categoryChart');
    
    if (!timeSeriesCanvas || !categoryCanvas) {
        console.error('❌ Canvas elements not found for empty timeline display');
        return;
    }
    
    const timeSeriesCtx = timeSeriesCanvas.getContext('2d');
    const categoryClearCtx = categoryCanvas.getContext('2d');
    
    // Clear both charts
    timeSeriesCtx.clearRect(0, 0, timeSeriesCtx.canvas.width, timeSeriesCtx.canvas.height);
    categoryClearCtx.clearRect(0, 0, categoryCanvas.width, categoryCanvas.height);
    
    // Show message
    timeSeriesCtx.fillStyle = '#666';
    timeSeriesCtx.font = '16px Arial';
    timeSeriesCtx.textAlign = 'center';
    timeSeriesCtx.fillText(
        'No events found for the selected date range',
        timeSeriesCtx.canvas.width / 2,
        timeSeriesCtx.canvas.height / 2
    );
    
    categoryCanvas.style.display = 'none';
}

// Calculate category time series data for comprehensive visualization
function calculateCategoryTimeSeriesData(events, dateLabels) {
    console.log(`🔍 Processing ${events.length} events across ${dateLabels.length} dates`);
    
    const categoryTimeData = {};
    
    // Initialize all date keys with zero values for all categories (matching distribution chart)
    dateLabels.forEach(dateKey => {
        categoryTimeData[dateKey] = {
            'prod': 0,
            'nonprod': 0,
            'admin': 0,
            'other': 0
        };
    });
    
    // Process all events and categorize them by date and content
    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const eventDate = new Date(event.start.dateTime);
            const dateKey = getLocalDateKey(eventDate);
            
            // Only process events that fall within our date range
            if (categoryTimeData[dateKey]) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60); // minutes
                
                const category = getCalendarKey(event.calendarName);
                categoryTimeData[dateKey][category] += duration;
            }
        }
    });
    
    console.log('📊 Category time data calculated:', categoryTimeData);
    return categoryTimeData;
}

function calculateCategoryTimeDistribution(events) {
    const distribution = {};

    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const duration = (end - start) / (1000 * 60); // minutes

            const category = getCalendarKey(event.calendarName);

            if (!distribution[category]) {
                distribution[category] = {
                    minutes: 0,
                    color: getCategoryColor(category)
                };
            }

            distribution[category].minutes += duration;
        }
    });

    console.log('📊 Category distribution calculated:', distribution);
    return distribution;
}

function getCategoryColor(category) {
    const colors = {
        'prod': '#4CAF50',      // Green - Production Work
        'nonprod': '#757575',   // Grey - Non-Production
        'admin': '#FF9800',     // Orange - Admin & Rest
        'other': '#BDBDBD'      // Light Grey - Other Activities
    };
    return colors[category] || '#BDBDBD';
}

function getCategoryDisplayName(category) {
    const displayNames = {
        'prod': 'Production Work',
        'nonprod': 'Non-Production',
        'admin': 'Admin & Rest',
        'other': 'Other Activities'
    };
    return displayNames[category] || 'Other';
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
