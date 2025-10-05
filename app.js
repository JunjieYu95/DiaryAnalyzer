// Global variables
let currentDate = new Date();
let accessToken = null;
let allEvents = [];
// gapi not needed - we use direct fetch calls to Google Calendar API

// Configuration is loaded from config.js
// CONFIG will be available globally from config.js
if (typeof CONFIG === 'undefined') {
    console.error('❌ CONFIG not loaded! Check config.js');
    // Fallback configuration
    window.CONFIG = {
        GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
        GOOGLE_API_KEY: 'NOT_NEEDED_FOR_DIRECT_FETCH', // Not needed for direct API calls
        DEBUG: true
    };
}

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
    console.log('🔧 Debug mode enabled:', CONFIG.DEBUG);
    console.log('🔑 Client ID configured:', CONFIG.GOOGLE_CLIENT_ID);
    console.log('🌐 Current origin:', window.location.origin);
    console.log('📱 User agent:', navigator.userAgent);
    
    // Check if authentication completed before app loaded
    if (window.authCompleted || window.globalAccessToken) {
        console.log('✅ Authentication completed before app loaded, processing...');
        accessToken = window.globalAccessToken || window.accessToken;
        console.log('🔑 Using global access token:', !!accessToken);
        showSection('loading');
        await loadCalendarData();
        return;
    }
    
    // Skip Google API client initialization - we use direct fetch calls instead
    console.log('⏭️ Skipping Google API client initialization - using direct fetch calls');
    
    // Setup event listeners
    setupEventListeners();
    
    // Check authentication status
    await checkAuthStatus();
    
    // Update current date display
    updateCurrentDateDisplay();
});

// Initialize Google API
async function initializeGoogleAPI() {
    console.log('🔧 Starting Google API initialization...');
    console.log('📊 GAPI available:', typeof gapi !== 'undefined');
    console.log('🔑 API Key configured:', CONFIG.GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY_HERE');
    
    return new Promise((resolve) => {
        if (typeof gapi !== 'undefined' && gapi && gapi.load) {
            console.log('📚 Loading Google API client...');
            gapi.load('client', async () => {
                try {
                    console.log('⚙️ Initializing Google API client...');
                    await gapi.client.init({
                        apiKey: CONFIG.GOOGLE_API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest']
                    });
                    console.log('✅ Google API initialized successfully');
                    resolve();
                } catch (error) {
                    console.error('❌ Failed to initialize Google API:', error);
                    console.error('🔍 Error details:', error.message, error.stack);
                    resolve(); // Continue even if API init fails
                }
            });
        } else {
            console.warn('⚠️ Google API not loaded yet, will retry...');
            console.log('🔍 gapi type:', typeof gapi);
            console.log('🔍 gapi exists:', !!gapi);
            console.log('🔍 gapi.load exists:', gapi && typeof gapi.load);
            setTimeout(() => initializeGoogleAPI().then(resolve), 1000);
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Debug: Check if elements exist
    console.log('🔍 Element check:');
    console.log('  - refreshBtn:', !!refreshBtn);
    console.log('  - retryBtn:', !!retryBtn);
    console.log('  - dateRange:', !!dateRange);
    console.log('  - viewMode:', !!viewMode);
    console.log('  - prevDayBtn:', !!prevDayBtn);
    console.log('  - nextDayBtn:', !!nextDayBtn);
    
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
        console.log('✅ Refresh button listener added');
    } else {
        console.error('❌ Refresh button not found');
    }
    
    if (retryBtn) {
        retryBtn.addEventListener('click', refreshData);
        console.log('✅ Retry button listener added');
    } else {
        console.error('❌ Retry button not found');
    }
    
    if (dateRange) {
        dateRange.addEventListener('change', onDateRangeChange);
        console.log('✅ Date range listener added');
        
        // Test if the element is working
        dateRange.addEventListener('change', function() {
            console.log('🔔 Date range change event fired! Value:', this.value);
        });
    } else {
        console.error('❌ Date range element not found');
    }
    
    if (viewMode) {
        viewMode.addEventListener('change', onViewModeChange);
        console.log('✅ View mode listener added');
        
        // Test if the element is working
        viewMode.addEventListener('change', function() {
            console.log('🔔 View mode change event fired! Value:', this.value);
        });
    } else {
        console.error('❌ View mode element not found');
    }
    
    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => navigateDate(-1));
        console.log('✅ Previous day button listener added');
    } else {
        console.error('❌ Previous day button not found');
    }
    
    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => navigateDate(1));
        console.log('✅ Next day button listener added');
    } else {
        console.error('❌ Next day button not found');
    }
    
    // Chart mode selector for advanced analytics
    const chartModeSelector = document.getElementById('chartMode');
    if (chartModeSelector) {
        chartModeSelector.addEventListener('change', onChartModeChange);
        console.log('✅ Chart mode selector listener added');
    } else {
        console.log('⚠️ Chart mode selector not found (this is OK if not on advanced view)');
    }
    
    const stackedChart = document.getElementById('stackedChart');
    if (stackedChart) {
        stackedChart.addEventListener('change', onChartModeChange);
        console.log('✅ Stacked chart selector listener added');
    } else {
        console.log('⚠️ Stacked chart selector not found (this is OK if not on advanced view)');
    }
    
    console.log('🔧 Event listeners setup complete');
}

// Handle Google Sign-In response - callback is now defined in HTML
// This function is kept for compatibility but the actual callback is in index.html

// Check authentication status
async function checkAuthStatus() {
    console.log('🔍 Checking authentication status...');
    try {
        const storedToken = localStorage.getItem('googleToken');
        console.log('💾 Stored token exists:', !!storedToken);
        console.log('💾 Stored token length:', storedToken ? storedToken.length : 0);

        // FORCE RE-SIGNIN FOR TESTING - Remove this line when ready for production
        const forceReSignin = true; // Set to false to allow stored tokens
        
        if (storedToken && !forceReSignin) {
            console.log('✅ Found stored token, checking validity...');
            accessToken = storedToken;
            showSection('loading');
            await loadCalendarData();
        } else {
            if (forceReSignin) {
                console.log('🔄 Force re-signin enabled for testing - clearing stored token');
                localStorage.removeItem('googleToken');
                window.globalAccessToken = null;
                window.accessToken = null;
            }
            console.log('🔍 No stored token found, showing auth section');
            showSection('auth');
            
            // Add debug info for Google Sign-In setup
            setTimeout(() => {
                debugGoogleSignInSetup();
            }, 1000);
        }
    } catch (error) {
        console.error('❌ Error checking auth status:', error);
        console.error('🔍 Error details:', error.message, error.stack);
        showSection('auth');
    }
}

// Debug function to check Google Sign-In setup
function debugGoogleSignInSetup() {
    console.log('🔧 === GOOGLE SIGN-IN DEBUG INFO ===');
    console.log('🌐 Current URL:', window.location.href);
    console.log('🌐 Origin:', window.location.origin);
    console.log('🔑 Client ID from CONFIG:', CONFIG.GOOGLE_CLIENT_ID);
    console.log('🔑 Client ID from HTML element:');
    
    const gIdOnload = document.getElementById('g_id_onload');
    if (gIdOnload) {
        console.log('📋 g_id_onload element found:', gIdOnload);
        console.log('📋 data-client_id:', gIdOnload.getAttribute('data-client_id'));
        console.log('📋 data-callback:', gIdOnload.getAttribute('data-callback'));
        console.log('📋 data-ux_mode:', gIdOnload.getAttribute('data-ux_mode'));
    } else {
        console.error('❌ g_id_onload element not found!');
    }
    
    const gIdSignin = document.querySelector('.g_id_signin');
    if (gIdSignin) {
        console.log('📋 g_id_signin element found:', gIdSignin);
    } else {
        console.error('❌ g_id_signin element not found!');
    }
    
    console.log('🔧 Callback function available:', typeof window.handleCredentialResponse);
    console.log('📚 Google Identity Services loaded:', typeof google !== 'undefined');
    
    if (typeof google !== 'undefined') {
        console.log('📚 Google object keys:', Object.keys(google));
        if (google.accounts) {
            console.log('📚 Google.accounts available:', !!google.accounts);
            console.log('📚 Google.accounts.id available:', !!google.accounts.id);
        }
    }
    
    console.log('🔧 === END DEBUG INFO ===');
}

// Global debug function for browser console
window.debugAuth = function() {
    console.log('🔧 === MANUAL DEBUG TRIGGER ===');
    debugGoogleSignInSetup();
    
    // Additional checks
    console.log('🔧 === ADDITIONAL CHECKS ===');
    console.log('🌐 Window.location:', window.location.href);
    console.log('🔑 CONFIG object:', CONFIG);
    console.log('📱 Local storage:', {
        googleToken: localStorage.getItem('googleToken') ? 'EXISTS' : 'NOT_FOUND',
        length: localStorage.getItem('googleToken')?.length || 0
    });
    
    // Check if Google Sign-In button is clickable
    const signinBtn = document.querySelector('.g_id_signin');
    if (signinBtn) {
        console.log('🔘 Sign-in button found and clickable:', !signinBtn.disabled);
        console.log('🔘 Button parent element:', signinBtn.parentElement);
    }
    
    console.log('🔧 === END MANUAL DEBUG ===');
}

// Global debug function for testing event listeners
window.testEventListeners = function() {
    console.log('🧪 === TESTING EVENT LISTENERS ===');
    
    // Test date range change
    console.log('🧪 Testing date range change...');
    const dateRange = document.getElementById('dateRange');
    if (dateRange) {
        console.log('📅 Current date range value:', dateRange.value);
        console.log('📅 Available options:', Array.from(dateRange.options).map(opt => opt.value));
        
        // Try to trigger change
        const originalValue = dateRange.value;
        dateRange.value = originalValue === 'today' ? 'week' : 'today';
        dateRange.dispatchEvent(new Event('change'));
        console.log('📅 Triggered change event, new value:', dateRange.value);
        
        // Reset
        dateRange.value = originalValue;
    } else {
        console.error('❌ Date range element not found');
    }
    
    // Test view mode change
    console.log('🧪 Testing view mode change...');
    const viewMode = document.getElementById('viewMode');
    if (viewMode) {
        console.log('👁️ Current view mode value:', viewMode.value);
        console.log('👁️ Available options:', Array.from(viewMode.options).map(opt => opt.value));
        
        // Try to trigger change
        const originalValue = viewMode.value;
        viewMode.value = originalValue === 'distribution' ? 'timeline' : 'distribution';
        viewMode.dispatchEvent(new Event('change'));
        console.log('👁️ Triggered change event, new value:', viewMode.value);
        
        // Reset
        viewMode.value = originalValue;
    } else {
        console.error('❌ View mode element not found');
    }
    
    console.log('🧪 === END EVENT LISTENER TEST ===');
}

// Load calendar data from Google Calendar API
// Make loadCalendarData globally available
window.loadCalendarData = async function loadCalendarData() {
    try {
        console.log('📅 Loading calendar data...');
        console.log('🔑 Access token exists:', !!accessToken);
        console.log('🔑 Access token from localStorage:', !!localStorage.getItem('googleToken'));
        console.log('🔑 Global access token:', !!window.globalAccessToken);
        
        // Try to get token from multiple sources
        if (!accessToken) {
            accessToken = window.globalAccessToken || localStorage.getItem('googleToken');
            console.log('🔑 Retrieved access token from alternative source:', !!accessToken);
        }

        // Validate token
        if (!accessToken) {
            throw new Error('No access token available. Please sign in again.');
        }

        // Fetch real calendar data from Google Calendar API
        console.log('📅 Fetching real calendar data from Google Calendar API...');
        allEvents = await fetchGoogleCalendarEvents();
        
        console.log(`📊 Total events loaded: ${allEvents.length}`);

        displayCurrentView();
        updateStats();
        showSection('content');
        
    } catch (error) {
        console.error('❌ Error loading calendar data:', error);
        
        let errorMessage = `Failed to load calendar data: ${error.message}`;
        
        // Add specific instructions for OAuth origin mismatch
        if (error.message.includes('401 Unauthorized')) {
            errorMessage += `

🔧 TO FIX THIS:
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Navigate to: APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID: 1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq
4. Click Edit (pencil icon)
5. Add to "Authorized JavaScript origins":
   http://localhost:8000
6. Save and wait 2-3 minutes
7. Refresh this page and try again`;
        }
        
        showError(errorMessage);
    }
}

// Fetch real calendar events from Google Calendar API
async function fetchGoogleCalendarEvents() {
    try {
        console.log('🔍 Fetching calendar list...');
        
        // Get calendar list
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
            if (calendarListResponse.status === 401) {
                throw new Error(`401 Unauthorized: OAuth origin mismatch. Please add 'http://localhost:8000' to Google Cloud Console OAuth settings. Status: ${calendarListResponse.status}`);
            }
            throw new Error(`Failed to fetch calendars: ${calendarListResponse.status}`);
        }

        const calendarList = await calendarListResponse.json();
        console.log('📅 Available calendars:', calendarList.items?.map(cal => cal.summary));

        // Filter for relevant calendars (primary + diary calendars)
        const relevantCalendars = calendarList.items?.filter(calendar =>
            calendar.id === 'primary' ||
            calendar.summary?.toLowerCase().includes('diary') ||
            calendar.summary?.toLowerCase().includes('actual')
        ) || [];

        console.log('📅 Relevant calendars:', relevantCalendars.map(cal => cal.summary));

        const timeMin = getDateRangeStart();
        const timeMax = getDateRangeEnd();

        // Fetch events from all relevant calendars
        let allEvents = [];

        for (const calendar of relevantCalendars) {
            console.log(`📅 Fetching events from: ${calendar.summary}`);

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
                console.log(`📅 Found ${events.length} events in ${calendar.summary}`);

                // Add calendar name to each event for reference
                events.forEach(event => {
                    event.calendarName = calendar.summary;
                });

                allEvents = allEvents.concat(events);
            } else {
                console.warn(`⚠️ Failed to fetch events from ${calendar.summary}: ${response.status}`);
            }
        }

        // Sort all events by start time
        allEvents.sort((a, b) => {
            const aTime = new Date(a.start.dateTime || a.start.date);
            const bTime = new Date(b.start.dateTime || b.start.date);
            return aTime - bTime;
        });

        console.log(`📊 Total events loaded: ${allEvents.length}`);
        return allEvents;

    } catch (error) {
        console.error('❌ Error fetching calendar events:', error);
        
        // NO MOCK DATA - Show error instead
        console.error('🚫 API failed - will show error instead of mock data');
        throw error; // Re-throw to show error to user
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
    console.log('📅 Date range changed to:', dateRange.value);
    if (accessToken) {
        showSection('loading');
        loadCalendarData();
    } else {
        console.warn('⚠️ No access token available for date range change');
    }
}

// Handle view mode change
function onViewModeChange() {
    console.log('👁️ View mode changed to:', viewMode.value);
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