// Global variables
let currentDate = new Date();
// accessToken is set by index.html OAuth flow - use window.accessToken
let allEvents = [];
// gapi not needed - we use direct fetch calls to Google Calendar API

// Calendar and highlights data
let currentYear = new Date().getFullYear();
let highlightsData = JSON.parse(localStorage.getItem('highlightsData') || '[]');

// Track if this is the initial app load (for showing Quick Log popup on startup)
let isInitialLoad = true;

// Add test highlights for debugging
function addTestHighlights() {
    const testHighlights = [
        {
            id: 'test-1',
            title: 'Test Highlight 1',
            description: 'This is a test highlight for October 12',
            date: '2024-10-12',
            type: 'highlight'
        },
        {
            id: 'test-2', 
            title: 'Test Milestone',
            description: 'This is a test milestone for October 13',
            date: '2024-10-13',
            type: 'milestone'
        }
    ];
    
    // Only add if not already present
    const existingTest = highlightsData.find(h => h.id === 'test-1');
    if (!existingTest) {
        highlightsData.push(...testHighlights);
        localStorage.setItem('highlightsData', JSON.stringify(highlightsData));
        console.log('📅 Added test highlights:', testHighlights);
    }
}

// Helper to get access token (works with both local and window scope)
function getAccessToken() {
    return window.accessToken || window.globalAccessToken || null;
}

// Configuration is loaded from config.js
// CONFIG will be available globally from config.js
if (typeof CONFIG === 'undefined') {
    console.error('❌ CONFIG not loaded! Make sure config.js exists');
    console.error('❌ Copy config.example.js to config.js and add your Google Client ID');
    alert('Configuration error: Please create config.js from config.example.js');
    throw new Error('CONFIG not loaded. See console for details.');
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
const aggregatedContainer = document.getElementById('aggregatedContainer');
const aggregatedChart = document.getElementById('aggregatedChart');
const aggregationPeriod = document.getElementById('aggregationPeriod');
const showEventCount = document.getElementById('showEventCount');
const refreshCategoryTrendsBtn = document.getElementById('refreshCategoryTrends');
// Tab elements - will be initialized in DOMContentLoaded
let analyticsTab;
let highlightsTab;
let analyticsTabContent;
let highlightsTabContent;
let highlightsLogButton;

// Calendar elements
const calendarContainer = document.getElementById('calendarContainer');
const calendarGrid = document.getElementById('calendarGrid');
const currentYearSpan = document.getElementById('currentYear');
const prevYearBtn = document.getElementById('prevYear');
const nextYearBtn = document.getElementById('nextYear');
const highlightDateInput = document.getElementById('highlightDate');
const highlightTitleInput = document.getElementById('highlightTitle');
const highlightDescriptionInput = document.getElementById('highlightDescription');
const highlightTypeSelect = document.getElementById('highlightType');
const saveHighlightBtn = document.getElementById('saveHighlight');
const dayDetailsModal = document.getElementById('dayDetailsModal');
const dayDetailsTitle = document.getElementById('dayDetailsTitle');
const dayDetailsDate = document.getElementById('dayDetailsDate');
const dayDetailsEvents = document.getElementById('dayDetailsEvents');
const dayDetailsHighlights = document.getElementById('dayDetailsHighlights');
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
    
    // Initialize tab elements
    analyticsTab = document.getElementById('analyticsTab');
    highlightsTab = document.getElementById('highlightsTab');
    analyticsTabContent = document.getElementById('analyticsTabContent');
    highlightsTabContent = document.getElementById('highlightsTabContent');
    highlightsLogButton = document.getElementById('highlightsLogButton');
    
    // Initialize calendar as main view
    displayCalendar();
    
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
    
    // Add event listeners for aggregated view controls
    if (aggregationPeriod) {
        aggregationPeriod.addEventListener('change', onAggregationPeriodChange);
        console.log('✅ Aggregation period listener added');
    } else {
        console.error('❌ Aggregation period element not found');
    }
    
    if (refreshCategoryTrendsBtn) {
        refreshCategoryTrendsBtn.addEventListener('click', () => {
            console.log('🔄 Refresh category trends button clicked');
            displayAggregatedView();
        });
        console.log('✅ Refresh category trends listener added');
    }
    
    if (showEventCount) {
        showEventCount.addEventListener('change', onEventCountToggleChange);
        console.log('✅ Event count toggle listener added');
    } else {
        console.error('❌ Event count toggle element not found');
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
    
    // Today button for quick jump to current date
    const todayBtn = document.getElementById('todayBtn');
    if (todayBtn) {
        todayBtn.addEventListener('click', jumpToToday);
        console.log('✅ Today button listener added');
    } else {
        console.log('⚠️ Today button not found');
    }
    
    // Log button for quick logging
    const logButton = document.getElementById('logButton');
    if (logButton) {
        logButton.addEventListener('click', showLogModal);
        console.log('✅ Log button listener added');
    } else {
        console.log('⚠️ Log button not found');
    }
    
    // Highlight modal form submission
    const logForm = document.getElementById('logForm');
    if (logForm) {
        logForm.addEventListener('submit', handleHighlightSubmit);
        console.log('✅ Highlight form listener added');
    }
    
    // Random recap button
    const randomRecapBtn = document.getElementById('randomRecapBtn');
    if (randomRecapBtn) {
        randomRecapBtn.addEventListener('click', showRandomRecapModal);
        console.log('✅ Random recap button listener added');
    } else {
        console.log('⚠️ Random recap button not found');
    }
    
    // Calendar view event listeners
    if (prevYearBtn) {
        prevYearBtn.addEventListener('click', () => navigateYear(-1));
        console.log('✅ Previous year button listener added');
    } else {
        console.error('❌ Previous year button not found');
    }
    
    if (nextYearBtn) {
        nextYearBtn.addEventListener('click', () => navigateYear(1));
        console.log('✅ Next year button listener added');
    } else {
        console.error('❌ Next year button not found');
    }
    
    if (saveHighlightBtn) {
        saveHighlightBtn.addEventListener('click', saveHighlight);
        console.log('✅ Save highlight button listener added');
    } else {
        console.error('❌ Save highlight button not found');
    }
    
    // Set today's date as default for highlight date input
    if (highlightDateInput) {
        highlightDateInput.value = new Date().toISOString().split('T')[0];
        console.log('✅ Highlight date input initialized');
    }

    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', signOut);
        console.log('✅ Sign out button listener added');
    } else {
        console.log('⚠️ Sign out button not found');
    }
    
    // Tab event listeners
    console.log('🔍 Tab elements check:');
    console.log('  - analyticsTab:', analyticsTab);
    console.log('  - highlightsTab:', highlightsTab);
    console.log('  - analyticsTabContent:', analyticsTabContent);
    console.log('  - highlightsTabContent:', highlightsTabContent);
    
    if (analyticsTab) {
        analyticsTab.addEventListener('click', () => switchTab('analytics'));
        console.log('✅ Analytics tab listener added');
    } else {
        console.error('❌ Analytics tab not found');
    }
    
    if (highlightsTab) {
        highlightsTab.addEventListener('click', () => switchTab('highlights'));
        console.log('✅ Highlights tab listener added');
    } else {
        console.error('❌ Highlights tab not found');
    }
    
    if (highlightsLogButton) {
        highlightsLogButton.addEventListener('click', openHighlightsLogModal);
        console.log('✅ Highlights log button listener added');
    } else {
        console.log('⚠️ Highlights log button not found');
    }
    
    // Keyboard navigation for date navigation
    document.addEventListener('keydown', (e) => {
        // Don't capture keyboard events when typing in inputs or modals
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        // Check if any modal is open
        const logModal = document.getElementById('logModal');
        const dayDetailsModal = document.getElementById('dayDetailsModal');
        const randomRecapModal = document.getElementById('randomRecapModal');
        if ((logModal && !logModal.classList.contains('hidden')) ||
            (dayDetailsModal && !dayDetailsModal.classList.contains('hidden')) ||
            (randomRecapModal && !randomRecapModal.classList.contains('hidden'))) {
            return;
        }
        
        // Arrow keys for date navigation
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigateDate(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigateDate(1);
        } else if (e.key === 't' || e.key === 'T') {
            // 'T' key to jump to today
            e.preventDefault();
            jumpToToday();
        }
    });
    console.log('✅ Keyboard navigation enabled (← → arrows, T for today)');
    
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

        // FORCE RE-SIGNIN FOR TESTING - Set to false for production to persist login
        const forceReSignin = false; // Set to true only for testing/debugging
        
        if (storedToken && !forceReSignin) {
            console.log('✅ Found stored token, checking validity...');
            accessToken = storedToken;
            showSection('loading');
            
            try {
                await loadCalendarData();
                console.log('✅ Stored token is valid, user signed in automatically');
                showSignOutButton();
            } catch (error) {
                console.log('❌ Stored token is invalid/expired, clearing and showing auth');
                localStorage.removeItem('googleToken');
                window.globalAccessToken = null;
                window.accessToken = null;
                showSection('auth');
                hideSignOutButton();
            }
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
        
        // Get access token using helper
        const accessToken = getAccessToken();
        console.log('🔑 Access token exists:', !!accessToken);
        console.log('🔑 Token length:', accessToken ? accessToken.length : 0);

        // Validate token
        if (!accessToken) {
            throw new Error('No access token available. Please sign in again.');
        }

        // Fetch real calendar data from Google Calendar API
        console.log('📅 Fetching real calendar data from Google Calendar API...');
        allEvents = await fetchGoogleCalendarEvents(accessToken);
        
        console.log(`📊 Total events loaded: ${allEvents.length}`);

        displayCurrentView();
        updateStats();
        updateCurrentDateDisplay();
        showSignOutButton();
        showSection('content');
        
        // Show Quick Log popup on initial app load (default view)
        if (isInitialLoad) {
            isInitialLoad = false;
            // Small delay to ensure UI is ready
            setTimeout(() => {
                console.log('📝 Opening Quick Log modal as default view...');
                showLogModal();
            }, 500);
        }
        
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

// Helper to make authenticated API calls with automatic token refresh on 401
async function fetchWithTokenRefresh(url, options = {}, retryCount = 0) {
    const accessToken = getAccessToken();
    
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    
    // If 401 and haven't retried yet, try refreshing the token
    if (response.status === 401 && retryCount === 0) {
        console.log('🔄 Got 401, attempting automatic token refresh...');
        
        // Try to refresh the token silently
        if (window.refreshGoogleToken) {
            try {
                await window.refreshGoogleToken();
                console.log('✅ Token refreshed, retrying API call...');
                
                // Retry the request with the new token
                return fetchWithTokenRefresh(url, options, retryCount + 1);
            } catch (refreshError) {
                console.error('❌ Token refresh failed:', refreshError);
                // Let the original 401 error propagate
            }
        }
    }
    
    return response;
}

// Fetch real calendar events from Google Calendar API
async function fetchGoogleCalendarEvents(accessToken) {
    try {
        console.log('🔍 Fetching calendar list...');
        console.log('🔑 Using access token (length):', accessToken ? accessToken.length : 0);
        
        // Get calendar list with automatic token refresh on 401
        const calendarListResponse = await fetchWithTokenRefresh(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList'
        );

        if (!calendarListResponse.ok) {
            if (calendarListResponse.status === 401) {
                throw new Error('Session expired. Please sign in again.');
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

        console.log('📅 All calendars found:', calendarList.items?.map(cal => cal.summary));
        console.log('📅 Relevant calendars:', relevantCalendars.map(cal => cal.summary));

        const timeMin = getDateRangeStart();
        const timeMax = getDateRangeEnd();
        
        console.log('📅 Date range for fetching events:');
        console.log('  - From:', timeMin.toISOString());
        console.log('  - To:', timeMax.toISOString());
        console.log('  - Current date range setting:', dateRange.value);

        // Fetch events from all relevant calendars
        allEvents = [];

        for (const calendar of relevantCalendars) {
            console.log(`📅 Fetching events from: ${calendar.summary}`);

            const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                `timeMin=${timeMin.toISOString()}&` +
                `timeMax=${timeMax.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime&` +
                `maxResults=2500`;

            const response = await fetchWithTokenRefresh(apiUrl);

            if (response.ok) {
                const data = await response.json();
                const events = data.items || [];
                console.log(`📅 Found ${events.length} events in ${calendar.summary}`);

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

// Helper function to divide event duration across days based on absolute timestamps
function divideEventAcrossDays(event, startDate, endDate) {
    if (!event.start.dateTime || !event.end.dateTime) {
        return [];
    }
    
    const eventStart = new Date(event.start.dateTime);
    const eventEnd = new Date(event.end.dateTime);
    const calendarKey = getCalendarKey(event.calendarName);
    
    // If event is outside our date range, return empty
    if (eventEnd < startDate || eventStart > endDate) {
        return [];
    }
    
    const dayAllocations = [];
    const currentDate = new Date(Math.max(eventStart, startDate));
    const finalDate = new Date(Math.min(eventEnd, endDate));
    
    // Set time to start of day for proper day-by-day calculation
    currentDate.setHours(0, 0, 0, 0);
    finalDate.setHours(0, 0, 0, 0);
    
    while (currentDate <= finalDate) {
        const dayStart = new Date(Math.max(eventStart, currentDate));
        const dayEnd = new Date(Math.min(eventEnd, new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)));
        
        // Only include if there's actual time in this day
        if (dayEnd > dayStart) {
            const duration = (dayEnd - dayStart) / (1000 * 60); // minutes
            const dateKey = getLocalDateKey(currentDate);
            
            dayAllocations.push({
                dateKey: dateKey,
                calendarKey: calendarKey,
                duration: duration,
                event: event
            });
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dayAllocations;
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
        case 'last1month':
            // Last 1 month: from exactly 1 month ago to today
            date.setMonth(date.getMonth() - 1);
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
        case 'last1year':
            // Last 1 year: from exactly 1 year ago to today
            date.setFullYear(date.getFullYear() - 1);
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
        case 'last1month':
            // Last 1 month: ends today
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
        case 'last1year':
            // Last 1 year: ends today
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
    } else if (range === 'last1month') {
        subtitle.textContent = 'Last 30 days time distribution';
    } else if (range === 'quarter') {
        subtitle.textContent = 'Quarterly time distribution';
    } else if (range === 'year') {
        subtitle.textContent = 'Yearly time distribution';
    } else if (range === 'last1year') {
        subtitle.textContent = 'Last 12 months time distribution';
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

    // Group events by date using proper day-by-day allocation
    events.forEach(event => {
        const dayAllocations = divideEventAcrossDays(event, startDate, endDate);
        
        dayAllocations.forEach(allocation => {
            if (eventsByDate[allocation.dateKey]) {
                eventsByDate[allocation.dateKey][allocation.calendarKey] += allocation.duration;
                eventsByDate[allocation.dateKey].total += allocation.duration;
            }
        });
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
    } else if (range === 'last1month') {
        rangeTitle = 'Last 30 Days';
    } else if (range === 'quarter') {
        rangeTitle = 'Quarterly';
    } else if (range === 'year') {
        rangeTitle = 'Yearly';
    } else if (range === 'last1year') {
        rangeTitle = 'Last 12 Months';
    } else {
        rangeTitle = getDateRangeDisplayName();
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
    // Calculate stats based on the selected date range, not just current day
    const startDate = getDateRangeStart();
    const endDate = getDateRangeEnd();
    const selectedRange = dateRange.value;
    
    console.log('📊 Updating stats for range:', selectedRange);
    console.log('📅 Date range:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
    console.log('📊 Total events available:', allEvents.length);

    const rangeEvents = allEvents.filter(event => {
        const eventDate = new Date(event.start.dateTime || event.start.date);
        return eventDate >= startDate && eventDate <= endDate;
    });
    
    console.log('📊 Events in range:', rangeEvents.length);

    // Total events
    totalEventsSpan.textContent = rangeEvents.length;

    // Active hours calculation using proper day-by-day allocation
    let totalMinutes = 0;
    rangeEvents.forEach(event => {
        const dayAllocations = divideEventAcrossDays(event, startDate, endDate);
        dayAllocations.forEach(allocation => {
            totalMinutes += allocation.duration;
        });
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    activeHoursSpan.textContent = `${hours}h ${minutes}m`;
    
    console.log('⏰ Total minutes calculated:', totalMinutes);
    console.log('⏰ Active hours display:', `${hours}h ${minutes}m`);

    // Most common activity
    const categories = {};
    rangeEvents.forEach(event => {
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

// Jump to today's date
function jumpToToday() {
    console.log('📅 Jumping to today');
    currentDate = new Date();
    updateCurrentDateDisplay();
    
    // Reload data for current date
    const token = getAccessToken();
    if (token) {
        showSection('loading');
        loadCalendarData();
    }
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
        case 'last1month':
            // Navigate by 1 month increments
            newDate.setMonth(newDate.getMonth() + direction);
            break;
        case 'quarter':
            newDate.setMonth(newDate.getMonth() + 3 * direction);
            break;
        case 'year':
            newDate.setFullYear(newDate.getFullYear() + direction);
            break;
        case 'last1year':
            // Navigate by 1 year increments
            newDate.setFullYear(newDate.getFullYear() + direction);
            break;
    }

    currentDate = newDate;
    updateCurrentDateDisplay();

    // Reload data for new date range
    const token = getAccessToken();
    if (token) {
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
    } else if (range === 'last1year' || range === 'last1month') {
        // For "last" ranges, show the full date range with year
        const startDate = getDateRangeStart();
        const endDate = getDateRangeEnd();
        
        const startStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const endStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        
        displayString = `${startStr} - ${endStr}`;
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
    const token = getAccessToken();
    if (token) {
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
    updateStats(); // Also update stats when view mode changes
}

// Tab switching functions
function switchTab(tabName) {
    console.log('🔄 Switching to tab:', tabName);
    console.log('🔄 Analytics tab element:', analyticsTab);
    console.log('🔄 Highlights tab element:', highlightsTab);
    console.log('🔄 Analytics tab content element:', analyticsTabContent);
    console.log('🔄 Highlights tab content element:', highlightsTabContent);
    
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabName === 'analytics') {
        if (!analyticsTab || !analyticsTabContent) {
            console.error('❌ Analytics tab elements not found!');
            console.error('  - analyticsTab:', analyticsTab);
            console.error('  - analyticsTabContent:', analyticsTabContent);
            return;
        }
        analyticsTab.classList.add('active');
        analyticsTabContent.classList.add('active');
        console.log('✅ Analytics tab activated');
        console.log('📊 Analytics tab content display:', window.getComputedStyle(analyticsTabContent).display);
        
        try {
            displayCurrentView(); // Show the current analytics view
            console.log('✅ displayCurrentView() completed');
        } catch (error) {
            console.error('❌ Error in displayCurrentView():', error);
        }
        
        try {
            updateStats();
            console.log('✅ updateStats() completed');
        } catch (error) {
            console.error('❌ Error in updateStats():', error);
        }
    } else if (tabName === 'highlights') {
        if (!highlightsTab || !highlightsTabContent) {
            console.error('❌ Highlights tab elements not found!');
            console.error('  - highlightsTab:', highlightsTab);
            console.error('  - highlightsTabContent:', highlightsTabContent);
            return;
        }
        highlightsTab.classList.add('active');
        highlightsTabContent.classList.add('active');
        console.log('✅ Highlights tab activated');
        console.log('🔄 Highlights tab content classes after adding active:', highlightsTabContent.classList.toString());
        
        try {
            displayCalendar(); // Show the calendar view
            console.log('✅ displayCalendar() completed');
        } catch (error) {
            console.error('❌ Error in displayCalendar():', error);
        }
    }
}

// Open highlights log modal
function openHighlightsLogModal() {
    console.log('📝 Opening highlights log modal');
    showHighlightModal();
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
    aggregatedContainer.classList.add('hidden');

    if (selectedView === 'timeline') {
        timelineContainer.classList.remove('hidden');
        displayTimeline();
    } else if (selectedView === 'distribution') {
        distributionContainer.classList.remove('hidden');
        displayDistribution();
    } else if (selectedView === 'advanced') {
        document.getElementById('advancedContainer').classList.remove('hidden');
        displayAdvancedAnalytics();
    } else if (selectedView === 'aggregated') {
        aggregatedContainer.classList.remove('hidden');
    }
}

// Display advanced analytics
function displayAdvancedAnalytics() {
    console.log('📊 Displaying advanced analytics...');
    
    try {
        const advancedCharts = document.getElementById('advancedCharts');
        
        if (!advancedCharts) {
            console.error('❌ Advanced charts container not found');
            return;
        }
        
        // Clear previous content
        advancedCharts.innerHTML = '';
        
        // Get the selected date range
        const startDate = getDateRangeStart();
        const endDate = getDateRangeEnd();
        
        // Filter events for the selected range
        const rangeEvents = allEvents.filter(event => {
            const eventDate = new Date(event.start.dateTime || event.start.date);
            return eventDate >= startDate && eventDate <= endDate;
        });
        
        console.log('📊 Range events for advanced analytics:', rangeEvents.length);
        
        if (rangeEvents.length === 0) {
            advancedCharts.innerHTML = '<div class="no-events">No events found in this date range</div>';
            return;
        }
        
        // Create simple stacked bar chart
        createSimpleStackedBarChart(rangeEvents, startDate, endDate);
        
    } catch (error) {
        console.error('❌ Error in displayAdvancedAnalytics:', error);
        const advancedCharts = document.getElementById('advancedCharts');
        if (advancedCharts) {
            advancedCharts.innerHTML = '<div class="no-events">Error loading advanced analytics: ' + error.message + '</div>';
        }
    }
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

// Create simple stacked bar chart using CSS and HTML
function createSimpleStackedBarChart(events, startDate, endDate) {
    console.log('📊 Creating simple stacked bar chart...');
    
    const advancedCharts = document.getElementById('advancedCharts');
    if (!advancedCharts) {
        console.error('❌ Advanced charts container not found');
        return;
    }
    
    // Group events by date and calculate daily totals by category
    const dailyData = {};
    const currentDate = new Date(startDate);
    
    // Initialize all dates in range
    while (currentDate <= endDate) {
        const dateKey = getLocalDateKey(currentDate);
        dailyData[dateKey] = {
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
    
    // Calculate daily totals by category
    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const eventDate = new Date(event.start.dateTime);
            const dateKey = getLocalDateKey(eventDate);
            
            if (dailyData[dateKey]) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60); // minutes
                
                const category = getCalendarKey(event.calendarName);
                dailyData[dateKey][category] += duration;
                dailyData[dateKey].total += duration;
            }
        }
    });
    
    // Find max total for scaling
    const maxTotal = Math.max(...Object.values(dailyData).map(day => day.total));
    
    if (maxTotal === 0) {
        advancedCharts.innerHTML = '<div class="no-events">No timed events found in this date range</div>';
        return;
    }
    
    // Create chart HTML
    let chartHTML = `
        <div class="stacked-bar-chart">
            <h4>Daily Activity Breakdown</h4>
            <div class="chart-container">
    `;
    
    const sortedDates = Object.keys(dailyData).sort();
    const numDays = sortedDates.length;
    
    // Calculate dynamic bar width based on number of days
    const maxBarWidth = 60;
    const minBarWidth = 30;
    const barWidth = Math.max(Math.min(maxBarWidth, Math.floor(400 / numDays)), minBarWidth);
    
    sortedDates.forEach(dateKey => {
        const day = dailyData[dateKey];
        
        // Calculate percentages for vertical stacking (based on total for that day, not max)
        const totalDayMinutes = day.total;
        const prodPercent = totalDayMinutes > 0 ? (day.prod / totalDayMinutes) * 100 : 0;
        const nonprodPercent = totalDayMinutes > 0 ? (day.nonprod / totalDayMinutes) * 100 : 0;
        const adminPercent = totalDayMinutes > 0 ? (day.admin / totalDayMinutes) * 100 : 0;
        const otherPercent = totalDayMinutes > 0 ? (day.other / totalDayMinutes) * 100 : 0;
        
        // Calculate bar height based on total time (max 200px)
        const barHeight = maxTotal > 0 ? Math.max((totalDayMinutes / maxTotal) * 200, 20) : 20;
        
        // Format time display
        const totalHours = Math.floor(day.total / 60);
        const totalMinutes = Math.floor(day.total % 60);
        const totalTimeStr = totalHours > 0 ? `${totalHours}h ${totalMinutes}m` : `${totalMinutes}m`;
        
        chartHTML += `
            <div class="bar-group-vertical" style="min-width: ${barWidth + 20}px">
                <div class="bar-label">${day.displayDate}</div>
                <div class="bar-container-vertical">
                    <div class="stacked-bar-vertical" style="height: ${barHeight}px; width: ${barWidth}px">
                        ${day.nonprod > 0 ? `<div class="bar-segment-vertical nonprod" style="height: ${nonprodPercent}%" title="Non-Production: ${Math.floor(day.nonprod/60)}h ${Math.floor(day.nonprod%60)}m"></div>` : ''}
                        ${day.admin > 0 ? `<div class="bar-segment-vertical admin" style="height: ${adminPercent}%" title="Admin & Rest: ${Math.floor(day.admin/60)}h ${Math.floor(day.admin%60)}m"></div>` : ''}
                        ${day.prod > 0 ? `<div class="bar-segment-vertical prod" style="height: ${prodPercent}%" title="Production: ${Math.floor(day.prod/60)}h ${Math.floor(day.prod%60)}m"></div>` : ''}
                    </div>
                    <div class="bar-time">${totalTimeStr}</div>
                </div>
            </div>
        `;
    });
    
    chartHTML += `
            </div>
            <div class="chart-legend">
                <div class="legend-item">
                    <div class="legend-color prod"></div>
                    <span>Production Work (Top)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color admin"></div>
                    <span>Admin & Rest (Middle)</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color nonprod"></div>
                    <span>Non-Production (Bottom)</span>
                </div>
            </div>
        </div>
    `;
    
    advancedCharts.innerHTML = chartHTML;
    console.log('✅ Simple stacked bar chart created successfully');
}


// Create simple data table as fallback
function createSimpleDataTable(events, startDate, endDate) {
    console.log('📊 Creating simple data table...');
    
    const advancedCharts = document.getElementById('advancedCharts');
    if (!advancedCharts) return;
    
    // Group events by date
    const dailyData = {};
    const currentDate = new Date(startDate);
    
    // Initialize all dates in range
    while (currentDate <= endDate) {
        const dateKey = getLocalDateKey(currentDate);
        dailyData[dateKey] = {
            date: new Date(currentDate),
            displayDate: currentDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
            events: [],
            totalMinutes: 0
        };
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Add events to dates
    events.forEach(event => {
        if (event.start.dateTime && event.end.dateTime) {
            const eventDate = new Date(event.start.dateTime);
            const dateKey = getLocalDateKey(eventDate);
            
            if (dailyData[dateKey]) {
                const start = new Date(event.start.dateTime);
                const end = new Date(event.end.dateTime);
                const duration = (end - start) / (1000 * 60); // minutes
                
                dailyData[dateKey].events.push(event);
                dailyData[dateKey].totalMinutes += duration;
            }
        }
    });
    
    // Create table HTML
    let tableHTML = `
        <div class="data-table-container">
            <h4>Daily Activity Summary</h4>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Events</th>
                        <th>Total Time</th>
                        <th>Categories</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    const sortedDates = Object.keys(dailyData).sort();
    sortedDates.forEach(dateKey => {
        const day = dailyData[dateKey];
        const hours = Math.floor(day.totalMinutes / 60);
        const minutes = Math.floor(day.totalMinutes % 60);
        const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
        
        // Get category summary
        const categories = {};
        day.events.forEach(event => {
            const category = categorizeEvent(event.summary);
            categories[category] = (categories[category] || 0) + 1;
        });
        const categoryStr = Object.entries(categories)
            .map(([cat, count]) => `${cat}(${count})`)
            .join(', ');
        
        tableHTML += `
            <tr>
                <td>${day.displayDate}</td>
                <td>${day.events.length}</td>
                <td>${timeStr}</td>
                <td>${categoryStr || 'N/A'}</td>
            </tr>
        `;
    });
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    advancedCharts.innerHTML = tableHTML;
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
    .advanced-charts {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .advanced-charts canvas {
        background: white;
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .data-table-container {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
    }
    .data-table th,
    .data-table td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
    }
    .data-table th {
        background-color: #f8f9fa;
        font-weight: 600;
        color: #495057;
    }
    .data-table tr:hover {
        background-color: #f8f9fa;
    }
    .stacked-bar-chart {
        background: white;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chart-container {
        margin: 20px 0;
        display: flex;
        align-items: end;
        gap: 8px;
        padding: 20px 0;
        border-bottom: 1px solid #e5e7eb;
        overflow-x: auto;
        min-width: 100%;
    }
    .bar-group-vertical {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        min-width: 5vw;
    }
    .bar-label {
        font-size: 0.9rem;
        font-weight: 500;
        color: #666;
        margin-bottom: 5px;
    }
    .bar-container-vertical {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        width: 100%;
    }
    .stacked-bar-vertical {
        background: #f0f0f0;
        border-radius: 4px 4px 0 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        position: relative;
        min-height: 20px;
    }
    .bar-segment-vertical {
        width: 100%;
        transition: height 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .bar-segment-vertical.prod {
        background: linear-gradient(180deg, #10b981, #059669);
    }
    .bar-segment-vertical.nonprod {
        background: linear-gradient(180deg, #6b7280, #4b5563);
    }
    .bar-segment-vertical.admin {
        background: linear-gradient(180deg, #f59e0b, #d97706);
    }
    .bar-segment-vertical.other {
        background: linear-gradient(180deg, #e5e7eb, #d1d5db);
    }
    .bar-time {
        font-size: 0.8rem;
        font-weight: 500;
        color: #374151;
        text-align: center;
        min-height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .chart-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
    }
    .legend-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.9rem;
    }
    .legend-color {
        width: 1.3vw;
        height: 1.3vw;
        border-radius: 3px;
    }
    .legend-color.prod {
        background: linear-gradient(45deg, #10b981, #059669);
    }
    .legend-color.nonprod {
        background: linear-gradient(45deg, #6b7280, #4b5563);
    }
    .legend-color.admin {
        background: linear-gradient(45deg, #f59e0b, #d97706);
    }
    .legend-color.other {
        background: linear-gradient(45deg, #e5e7eb, #d1d5db);
    }
    .controls {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
    }
    .log-btn {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
    }
    .log-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4);
    }
    .signout-btn {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 10px 16px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
    }
    .signout-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4);
    }
    .hidden {
        display: none !important;
    }
    .log-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        z-index: 1000;
        padding-top: 5vh;
        overflow-y: auto;
    }
    .log-modal-content {
        background: white;
        border-radius: 12px;
        padding: 30px;
        max-width: 600px;
        max-height: 90vh;
        min-width: 500px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
    }
    .log-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    .log-modal h2 {
        margin: 0;
        color: #1f2937;
    }
    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #6b7280;
        padding: 0;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }
    .close-btn:hover {
        background: #f3f4f6;
    }
    .form-group {
        margin-bottom: 20px;
    }
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #374151;
    }
    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
        box-sizing: border-box;
    }
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: #6366f1;
    }
    .form-group textarea {
        resize: vertical;
        min-height: 8vh;
    }
    .modal-actions {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 30px;
    }
    .btn {
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: none;
    }
    .btn-primary {
        background: #6366f1;
        color: white;
    }
    .btn-primary:hover {
        background: #5b21b6;
    }
    .btn-secondary {
        background: #6b7280;
        color: white;
    }
    .btn-secondary:hover {
        background: #4b5563;
    }
    
    /* Mobile responsive styles for log modal */
    @media (max-width: 768px) {
        .log-modal {
            padding-top: 2vh;
        }
        
        .log-modal-content {
            max-width: 95vw;
            max-height: 95vh;
            min-width: 90vw;
            padding: 20px;
            margin: 10px;
        }
        
        .form-group input,
        .form-group select,
        .form-group textarea {
            font-size: 16px; /* Prevent zoom on iOS */
        }
        
        .modal-actions {
            flex-direction: column;
            gap: 10px;
        }
        
        .btn {
            width: 100%;
            padding: 14px 24px;
        }
    }
    
    @media (max-width: 480px) {
        .log-modal-content {
            padding: 15px;
            margin: 5px;
            max-height: 96vh;
        }
        
        .log-modal h2 {
            font-size: 1.25rem;
        }
        
        .close-btn {
            width: 35px;
            height: 35px;
            font-size: 20px;
        }
    }
`;
document.head.appendChild(style);

// Highlight Modal Functions (for logging highlights/milestones)
function showHighlightModal() {
    console.log('📝 Opening highlight modal...');
    
    const modal = document.getElementById('logModal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Set today's date as default
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('highlightDate');
        if (dateInput) {
            dateInput.value = today;
        }
        
        // Focus on title input
        const titleInput = document.getElementById('highlightTitle');
        if (titleInput) {
            titleInput.focus();
        }
        
        console.log('✅ Highlight modal opened');
    } else {
        console.error('❌ Highlight modal not found');
    }
}

function closeHighlightModal() {
    const modal = document.getElementById('logModal');
    if (modal) {
        modal.classList.add('hidden');
        console.log('✅ Highlight modal closed');
    }
}

// Quick Log Modal Functions (for logging events with start/end times)
async function showLogModal() {
    console.log('📝 Opening Quick Log modal...');
    
    // Get the last event's end time as default start time (looks at past week)
    const lastEventEndTime = await getLastEventEndTime();
    const currentTime = new Date();
    
    console.log('🔍 DEBUG: Quick Log time calculation:');
    console.log('  - lastEventEndTime:', lastEventEndTime ? lastEventEndTime.toLocaleString() : 'null');
    console.log('  - currentTime:', currentTime.toLocaleString());
    
    // Format times for datetime-local input
    const formatDateTimeLocal = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    const startTime = lastEventEndTime ? formatDateTimeLocal(lastEventEndTime) : formatDateTimeLocal(currentTime);
    const endTime = formatDateTimeLocal(currentTime);
    
    console.log('  - startTime (formatted):', startTime);
    console.log('  - endTime (formatted):', endTime);
    
    // Create modal HTML
    const modalHTML = `
        <div id="quickLogModal" class="log-modal">
            <div class="log-modal-content">
                <div class="log-modal-header">
                    <h2>📝 Quick Log</h2>
                    <button class="close-btn" onclick="closeLogModal()">&times;</button>
                </div>
                <form id="quickLogForm">
                    <div class="form-group">
                        <label for="eventTitle">Event Title *</label>
                        <input type="text" id="eventTitle" name="eventTitle" placeholder="e.g., Team Meeting, Code Review" required>
                    </div>
                    <div class="form-group">
                        <label for="eventCalendar">Calendar</label>
                        <select id="eventCalendar" name="eventCalendar">
                            <option value="Actual Diary-Prod">Production Work</option>
                            <option value="Actual Diary-Nonprod">Non-Production</option>
                            <option value="Actual Diary-Admin/Rest/Routine">Admin & Rest</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="eventStart">Start Time</label>
                        <input type="datetime-local" id="eventStart" name="eventStart" value="${startTime}" required>
                    </div>
                    <div class="form-group">
                        <label for="eventEnd">End Time</label>
                        <input type="datetime-local" id="eventEnd" name="eventEnd" value="${endTime}" required>
                    </div>
                    <div class="form-group">
                        <label for="eventDescription">Description (Optional)</label>
                        <textarea id="eventDescription" name="eventDescription" placeholder="Add any additional details..."></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeLogModal()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Create Event</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add form submit handler
    document.getElementById('quickLogForm').addEventListener('submit', handleQuickLogSubmit);
    
    console.log('✅ Quick Log modal opened with start time:', startTime, 'end time:', endTime);
}

function closeLogModal() {
    const modal = document.getElementById('quickLogModal');
    if (modal) {
        modal.remove();
        console.log('✅ Quick Log modal closed');
    }
}

async function getLastEventEndTime() {
    console.log('🔍 getLastEventEndTime called');
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.log('  - No access token available');
        return null;
    }
    
    try {
        const calendarListResponse = await fetchWithTokenRefresh(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList'
        );
        
        if (!calendarListResponse.ok) {
            console.log('  - Failed to fetch calendar list');
            return null;
        }
        
        const calendarList = await calendarListResponse.json();
        const relevantCalendars = calendarList.items?.filter(calendar =>
            calendar.id === 'primary' ||
            calendar.summary?.toLowerCase().includes('diary') ||
            calendar.summary?.toLowerCase().includes('actual')
        ) || [];
        
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        let allRecentEvents = [];
        
        for (const calendar of relevantCalendars) {
            const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                `timeMin=${oneWeekAgo.toISOString()}&` +
                `timeMax=${now.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime&` +
                `maxResults=2500`;
            
            const response = await fetchWithTokenRefresh(apiUrl);
            
            if (response.ok) {
                const data = await response.json();
                const events = data.items || [];
                events.forEach(event => event.calendarName = calendar.summary);
                allRecentEvents = allRecentEvents.concat(events);
            }
        }
        
        if (allRecentEvents.length === 0) return null;
        
        const timedEvents = allRecentEvents.filter(event => event.end?.dateTime);
        if (timedEvents.length === 0) return null;
        
        const sortedEvents = timedEvents.sort((a, b) => 
            new Date(b.end.dateTime) - new Date(a.end.dateTime)
        );
        
        return new Date(sortedEvents[0].end.dateTime);
        
    } catch (error) {
        console.error('Error in getLastEventEndTime:', error);
        return null;
    }
}

// Handle Quick Log form submission (for events with start/end times)
async function handleQuickLogSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const eventData = {
        summary: formData.get('eventTitle'),
        calendar: formData.get('eventCalendar'),
        start: formData.get('eventStart'),
        end: formData.get('eventEnd'),
        description: formData.get('eventDescription') || ''
    };
    
    console.log('📝 Creating quick log event:', eventData);
    
    try {
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating...';
        submitBtn.disabled = true;
        
        // Create the event via Google Calendar API
        await createCalendarEvent(eventData);
        
        // Success
        console.log('✅ Event created successfully');
        closeLogModal();
        
        // Refresh the data to show the new event
        await loadCalendarData();
        
        // Show detailed success message
        const eventTitle = eventData.summary;
        const startTime = new Date(eventData.start).toLocaleString();
        alert(`✅ Event created successfully!\n\n📝 Title: ${eventTitle}\n⏰ Time: ${startTime}\n📅 Calendar: ${eventData.calendar}\n\nCheck your Google Calendar to see the event!`);
        
    } catch (error) {
        console.error('❌ Failed to create event:', error);
        alert('❌ Failed to create event: ' + error.message);
        
        // Reset button
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Create Event';
        submitBtn.disabled = false;
    }
}

// Handle Highlight form submission (for highlights/milestones)
async function handleHighlightSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const highlightData = {
        date: formData.get('highlightDate'),
        title: formData.get('highlightTitle'),
        description: formData.get('highlightDescription') || '',
        type: formData.get('highlightType')
    };
    
    console.log('📝 Creating highlight:', highlightData);
    
    try {
        // Show loading state
        const submitBtn = event.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;
        
        // Save the highlight
        await saveHighlight(highlightData);
        
        // Success
        console.log('✅ Highlight saved successfully');
        closeHighlightModal();
        
        // Refresh the calendar to show the new highlight
        displayCalendar();
        
        // Show success message
        alert(`✅ Highlight saved successfully!\n\n📝 Title: ${highlightData.title}\n📅 Date: ${highlightData.date}\n⭐ Type: ${highlightData.type}`);
        
    } catch (error) {
        console.error('❌ Failed to save highlight:', error);
        alert('❌ Failed to save highlight: ' + error.message);
        
        // Reset button
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.textContent = '💾 Save Highlight';
        submitBtn.disabled = false;
    }
}

async function createCalendarEvent(eventData) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available. Please sign in again.');
    }
    
    const startDateTime = new Date(eventData.start).toISOString();
    const endDateTime = new Date(eventData.end).toISOString();
    
    const eventPayload = {
        summary: eventData.summary,
        description: eventData.description,
        start: {
            dateTime: startDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
            dateTime: endDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    };
    
    console.log('📅 Creating event:', eventPayload.summary);
    
    const calendarListResponse = await fetchWithTokenRefresh(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList'
    );
    
    if (!calendarListResponse.ok) {
        throw new Error('Failed to fetch calendar list');
    }
    
    const calendarList = await calendarListResponse.json();
    
    // Try exact match first
    let selectedCalendar = calendarList.items?.find(cal => cal.summary === eventData.calendar);
    
    // If no exact match, try case-insensitive match
    if (!selectedCalendar) {
        selectedCalendar = calendarList.items?.find(cal => 
            cal.summary?.toLowerCase() === eventData.calendar.toLowerCase()
        );
    }
    
    // If still no match, try partial match for "Actual Diary" calendars
    if (!selectedCalendar && eventData.calendar.includes('Actual Diary')) {
        const searchTerm = eventData.calendar.toLowerCase().replace(/\s+/g, '');
        selectedCalendar = calendarList.items?.find(cal => 
            cal.summary?.toLowerCase().replace(/\s+/g, '') === searchTerm
        );
    }
    
    let targetCalendar = 'primary'; // default fallback
    
    if (selectedCalendar) {
        targetCalendar = selectedCalendar.id;
        console.log(`📅 Found target calendar: ${selectedCalendar.summary} (ID: ${selectedCalendar.id})`);
    } else {
        console.log(`⚠️ Calendar "${eventData.calendar}" not found, using primary calendar`);
        console.log(`📋 Available calendars:`, calendarList.items?.map(cal => cal.summary));
    }
    
    console.log('📅 Creating event in calendar:', targetCalendar);
    
    const response = await fetchWithTokenRefresh(
        `https://www.googleapis.com/calendar/v3/calendars/${targetCalendar}/events`,
        {
            method: 'POST',
            body: JSON.stringify(eventPayload)
        }
    );
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create event: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const result = await response.json();
    console.log('✅ Event created:', result.summary);
    return result;
}

// Sign out functionality
function signOut() {
    console.log('🚪 Signing out...');
    
    // Clear all stored tokens
    localStorage.removeItem('diaryAnalyzerToken');
    localStorage.removeItem('googleToken');
    localStorage.removeItem('googleTokenData');
    window.globalAccessToken = null;
    window.accessToken = null;
    
    // Hide sign out button
    hideSignOutButton();
    
    // Show auth section
    showSection('auth');
    
    // Re-render sign-in button if available
    if (typeof renderSignInButton === 'function') {
        renderSignInButton();
    }
    
    console.log('✅ Signed out');
}

// Show sign out button
function showSignOutButton() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.classList.remove('hidden');
    }
}

// Hide sign out button
function hideSignOutButton() {
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.classList.add('hidden');
    }
}

// Random Recap Modal Functions
function showRandomRecapModal() {
    console.log('🎲 Opening random recap modal...');
    
    // Show the existing modal
    const modal = document.getElementById('randomRecapModal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Add event listener for generate button if not already added
        const generateBtn = document.getElementById('generateRandomRecap');
        if (generateBtn && !generateBtn.hasAttribute('data-listener-added')) {
            generateBtn.addEventListener('click', generateRandomRecap);
            generateBtn.setAttribute('data-listener-added', 'true');
        }
        
        // Add click-outside-to-close functionality
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeRandomRecapModal();
            }
        });
        
        // Add escape key to close
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeRandomRecapModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Auto-generate random day when modal opens
        console.log('🎲 Auto-generating random day...');
        generateRandomRecap();
        
        console.log('✅ Random recap modal opened');
    } else {
        console.error('❌ Random recap modal not found');
    }
}

function closeRandomRecapModal() {
    const modal = document.getElementById('randomRecapModal');
    if (modal) {
        modal.classList.add('hidden');
        console.log('✅ Random recap modal closed');
    }
}

async function generateRandomRecap() {
    console.log('🎲 Generating random recap...');
    
    const lookbackDays = parseInt(document.getElementById('lookbackPeriod').value);
    const generateBtn = document.getElementById('generateRandomRecap');
    const loadingDiv = document.querySelector('.random-recap-loading');
    const resultsDiv = document.getElementById('randomRecapResults');
    
    // Show loading state
    generateBtn.disabled = true;
    generateBtn.textContent = 'Searching...';
    loadingDiv.classList.remove('hidden');
    resultsDiv.innerHTML = '';
    
    try {
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available. Please sign in again.');
        }
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - lookbackDays);
        
        console.log(`🔍 Searching for random day in last ${lookbackDays} days`);
        
        const calendarListResponse = await fetchWithTokenRefresh(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList'
        );
        
        if (!calendarListResponse.ok) {
            throw new Error('Failed to fetch calendar list');
        }
        
        const calendarList = await calendarListResponse.json();
        const relevantCalendars = calendarList.items?.filter(calendar =>
            calendar.id === 'primary' ||
            calendar.summary?.toLowerCase().includes('diary') ||
            calendar.summary?.toLowerCase().includes('actual')
        ) || [];
        
        let allEvents = [];
        
        for (const calendar of relevantCalendars) {
            const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                `timeMin=${startDate.toISOString()}&` +
                `timeMax=${endDate.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime&` +
                `maxResults=2500`;
            
            const response = await fetchWithTokenRefresh(apiUrl);
            
            if (response.ok) {
                const data = await response.json();
                const events = data.items || [];
                events.forEach(event => event.calendarName = calendar.summary);
                allEvents = allEvents.concat(events);
            }
        }
        
        console.log(`📊 Total events found: ${allEvents.length}`);
        
        // Group events by date
        const eventsByDate = {};
        allEvents.forEach(event => {
            if (event.start.dateTime || event.start.date) {
                const eventDate = new Date(event.start.dateTime || event.start.date);
                const dateKey = getLocalDateKey(eventDate);
                
                if (!eventsByDate[dateKey]) {
                    eventsByDate[dateKey] = {
                        date: eventDate,
                        events: []
                    };
                }
                eventsByDate[dateKey].events.push(event);
            }
        });
        
        // Find dates with events
        const datesWithEvents = Object.keys(eventsByDate).filter(dateKey => 
            eventsByDate[dateKey].events.length > 0
        );
        
        console.log(`📅 Dates with events: ${datesWithEvents.length}`);
        
        if (datesWithEvents.length === 0) {
            throw new Error('No events found in the selected time period. Try expanding your lookback period.');
        }
        
        // Select a random date with retry mechanism
        const maxAttempts = 10;
        let selectedDate = null;
        let attempts = 0;
        
        while (!selectedDate && attempts < maxAttempts) {
            const randomIndex = Math.floor(Math.random() * datesWithEvents.length);
            const randomDateKey = datesWithEvents[randomIndex];
            const dayEvents = eventsByDate[randomDateKey].events;
            
            // Check if this date has meaningful events (not just all-day events)
            const hasTimedEvents = dayEvents.some(event => event.start.dateTime);
            
            if (hasTimedEvents) {
                selectedDate = {
                    dateKey: randomDateKey,
                    date: eventsByDate[randomDateKey].date,
                    events: dayEvents
                };
                console.log(`✅ Selected random date: ${randomDateKey} with ${dayEvents.length} events`);
            } else {
                console.log(`⚠️ Date ${randomDateKey} has only all-day events, trying again...`);
                attempts++;
            }
        }
        
        if (!selectedDate) {
            throw new Error('Could not find a suitable random day with timed events. Try expanding your lookback period.');
        }
        
        // Display the random day
        displayRandomDay(selectedDate, startDate, endDate);
        
    } catch (error) {
        console.error('❌ Error generating random recap:', error);
        resultsDiv.innerHTML = `
            <div class="random-recap-error">
                <h4>❌ Error</h4>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        // Reset button state
        generateBtn.disabled = false;
        generateBtn.textContent = '🎲 Generate Random Day';
        loadingDiv.classList.add('hidden');
    }
}

function displayRandomDay(selectedDate, startDate, endDate) {
    const resultsDiv = document.getElementById('randomRecapResults');
    const { date, events } = selectedDate;
    
    // Sort events by start time
    events.sort((a, b) => {
        const aTime = new Date(a.start.dateTime || a.start.date);
        const bTime = new Date(b.start.dateTime || b.start.date);
        return aTime - bTime;
    });
    
    // Format date display
    const dateStr = date.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const timeAgo = getTimeAgo(date);
    
    // Calculate total time using proper day-by-day allocation
    let totalMinutes = 0;
    events.forEach(event => {
        const dayAllocations = divideEventAcrossDays(event, startDate, endDate);
        dayAllocations.forEach(allocation => {
            totalMinutes += allocation.duration;
        });
    });
    
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const totalTimeStr = totalHours > 0 ? `${totalHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    
    // Create timeline HTML
    let timelineHTML = '';
    events.forEach(event => {
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);
        
        const timeStr = event.start.dateTime ?
            `${formatTime(startTime)} - ${formatTime(endTime)}` :
            'All day';
        
        const category = categorizeEvent(event.summary);
        
        timelineHTML += `
            <div class="random-recap-timeline-item">
                <div class="random-recap-timeline-time">${timeStr}</div>
                <div class="random-recap-timeline-title">${event.summary || 'No title'}</div>
                ${event.description ? `<div class="random-recap-timeline-description">${event.description}</div>` : ''}
                <div class="random-recap-timeline-category category-${category}">${category}</div>
                ${event.calendarName ? `<div class="random-recap-timeline-calendar">📅 ${event.calendarName}</div>` : ''}
            </div>
        `;
    });
    
    // Display results
    resultsDiv.innerHTML = `
        <div class="random-recap-success">
            <h4>🎉 Found a random day!</h4>
            <p>Here's what you were up to on a random day from your calendar.</p>
        </div>
        
        <div class="random-recap-timeline">
            <h3>📅 Timeline</h3>
            <div class="random-recap-timeline-date">
                <h4>${dateStr}</h4>
                <p>${timeAgo} • ${events.length} events • ${totalTimeStr} total</p>
            </div>
            <div class="random-recap-timeline-events">
                ${timelineHTML}
            </div>
        </div>
    `;
    
    console.log(`✅ Random day displayed: ${dateStr} with ${events.length} events`);
}

function getTimeAgo(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    } else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return months === 1 ? '1 month ago' : `${months} months ago`;
    } else {
        const years = Math.floor(diffDays / 365);
        return years === 1 ? '1 year ago' : `${years} years ago`;
    }
}

// ===== AGGREGATED CATEGORY TRENDS FUNCTIONS =====

// Display aggregated view
function displayAggregatedView() {
    console.log('📊 Displaying aggregated category trends...');
    
    try {
        if (!aggregatedChart) {
            console.error('❌ Aggregated chart container not found');
            return;
        }
        
        // Clear previous content
        aggregatedChart.innerHTML = '';
        
        // Use the selected date range for aggregation
        // This ensures the chart shows the full selected period, not just event dates
        const startDate = getDateRangeStart();
        const endDate = getDateRangeEnd();
        
        console.log('📊 Category Trends date range:', startDate.toLocaleDateString(), 'to', endDate.toLocaleDateString());
        
        // Filter events within the selected date range
        const rangeEvents = allEvents.filter(event => {
            const eventStart = new Date(event.start.dateTime || event.start.date);
            const eventEnd = new Date(event.end.dateTime || event.end.date);
            // Include event if it overlaps with the date range
            return eventStart <= endDate && eventEnd >= startDate;
        });
        
        console.log('📊 Total events for aggregated view:', rangeEvents.length);
        
        if (rangeEvents.length === 0) {
            const rangeText = getDateRangeDisplayName().toLowerCase();
            aggregatedChart.innerHTML = `<div class="no-events">No events found for ${rangeText}</div>`;
            return;
        }
        
        // Create aggregated chart with the selected date range
        createAggregatedChart(rangeEvents, startDate, endDate);
        
    } catch (error) {
        console.error('❌ Error in displayAggregatedView:', error);
        if (aggregatedChart) {
            aggregatedChart.innerHTML = '<div class="no-events">Error loading aggregated view: ' + error.message + '</div>';
        }
    }
}

// Get available categories from events
function getAvailableCategories(events) {
    const categories = new Set();
    events.forEach(event => {
        const category = getCalendarKey(event.calendarName);
        categories.add(category);
    });
    
    // Return categories in preferred order
    const categoryOrder = ['prod', 'nonprod', 'admin', 'other'];
    return categoryOrder.filter(cat => categories.has(cat));
}

// Handle aggregation period change
function onAggregationPeriodChange() {
    console.log('📅 Aggregation period changed to:', aggregationPeriod.value);
    displayAggregatedView();
}

// Handle event count toggle change
function onEventCountToggleChange() {
    console.log('📊 Event count toggle changed to:', showEventCount.checked);
    displayAggregatedView();
}

// Handle category selection change (kept for compatibility but not used with checkboxes)
function onCategorySelectionChange() {
    console.log('📊 Category selection changed');
    displayAggregatedView();
}

// Create aggregated chart using Chart.js
function createAggregatedChart(events, startDate, endDate) {
    console.log('📊 Creating aggregated chart...');
    
    if (!aggregatedChart) {
        console.error('❌ Aggregated chart container not found');
        return;
    }
    
    // Get all available categories from events
    const selectedCategories = getSelectedCategories(events);
    if (selectedCategories.length === 0) {
        aggregatedChart.innerHTML = '<div class="no-events">No categories found</div>';
        return;
    }
    
    // Get aggregation period
    const period = aggregationPeriod ? aggregationPeriod.value : 'weekly';
    const showEventCounts = showEventCount ? showEventCount.checked : false;
    
    // Aggregate data
    const aggregatedData = aggregateDataByPeriod(events, startDate, endDate, period, selectedCategories);
    
    if (aggregatedData.length === 0) {
        aggregatedChart.innerHTML = '<div class="no-events">No data available for the selected period and categories</div>';
        return;
    }
    
    // Create Chart.js chart
    const ctx = document.createElement('canvas');
    aggregatedChart.innerHTML = '';
    aggregatedChart.appendChild(ctx);
    
    // Prepare data for Chart.js
    const labels = aggregatedData.map(item => item.period);
    const datasets = selectedCategories.map(category => {
        const categoryData = aggregatedData.map(item => item.categories[category] || 0);
        const color = getCategoryColor(category);
        
        return {
            label: getCategoryDisplayName(category),
            data: categoryData,
            borderColor: color,
            backgroundColor: color + '20', // Add transparency
            borderWidth: 2,
            fill: false,
            tension: 0.1
        };
    });
    
    // Add event count datasets if enabled
    if (showEventCounts) {
        selectedCategories.forEach(category => {
            const eventCountData = aggregatedData.map(item => item.eventCounts[category] || 0);
            const color = getCategoryColor(category);
            
            datasets.push({
                label: `${getCategoryDisplayName(category)} (Events)`,
                data: eventCountData,
                borderColor: color,
                backgroundColor: color + '10',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                yAxisID: 'y1'
            });
        });
    }
    
    // Format date range for title
    const startDateStr = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRangeLabel = getDateRangeDisplayName();
    
    // Create chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: [`Category Trends - ${period.charAt(0).toUpperCase() + period.slice(1)} View`, `${dateRangeLabel}: ${startDateStr} - ${endDateStr}`],
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    },
                    onClick: function(e, legendItem, legend) {
                        // Default Chart.js legend click handler - toggles dataset visibility
                        const index = legendItem.datasetIndex;
                        const ci = legend.chart;
                        const meta = ci.getDatasetMeta(index);
                        
                        // Toggle visibility
                        meta.hidden = meta.hidden === null ? !ci.data.datasets[index].hidden : null;
                        ci.update();
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            
                            if (label.includes('(Events)')) {
                                return `${label}: ${value} events`;
                            } else {
                                const hours = Math.floor(value / 60);
                                const minutes = Math.floor(value % 60);
                                const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                                return `${label}: ${timeStr}`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time Period'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Time (minutes)'
                    },
                    ticks: {
                        callback: function(value) {
                            const hours = Math.floor(value / 60);
                            const minutes = Math.floor(value % 60);
                            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                        }
                    }
                },
                y1: showEventCounts ? {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Event Count'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                } : undefined
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    
    console.log('✅ Aggregated chart created successfully');
}

// Get selected categories - returns all available categories by default
function getSelectedCategories(events) {
    if (!events || events.length === 0) {
        return ['prod', 'nonprod', 'admin', 'other'];
    }
    
    // Get all available categories from events
    return getAvailableCategories(events);
}

// Aggregate data by period (weekly or monthly)
function aggregateDataByPeriod(events, startDate, endDate, period, categories) {
    const aggregatedData = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        let periodStart, periodEnd;
        let periodLabel;
        
        if (period === 'weekly') {
            // Get start of week (Monday)
            const dayOfWeek = currentDate.getDay();
            const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            periodStart = new Date(currentDate);
            periodStart.setDate(currentDate.getDate() + mondayOffset);
            periodStart.setHours(0, 0, 0, 0);
            
            // Get end of week (Sunday) - set to end of day to capture all Sunday events
            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodStart.getDate() + 6);
            periodEnd.setHours(23, 59, 59, 999);
            
            // Format label
            const weekStartStr = periodStart.toLocaleDateString([], { month: 'short', day: 'numeric' });
            const weekEndStr = periodEnd.toLocaleDateString([], { month: 'short', day: 'numeric' });
            periodLabel = `${weekStartStr} - ${weekEndStr}`;
            
            // Move to next week - must use periodStart as base to handle month boundaries correctly
            currentDate = new Date(periodStart);
            currentDate.setDate(currentDate.getDate() + 7);
        } else {
            // Monthly aggregation
            periodStart = new Date(currentDate);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            periodEnd.setHours(23, 59, 59, 999);
            if (periodEnd > endDate) periodEnd = endDate;
            
            // Format label
            periodLabel = currentDate.toLocaleDateString([], { month: 'short', year: 'numeric' });
            
            // Move to next month
            currentDate.setMonth(currentDate.getMonth() + 1);
            currentDate.setDate(1);
        }
        
        // Calculate totals for each category using proper day-by-day allocation
        const categoryTotals = {};
        const eventCounts = {};
        
        categories.forEach(category => {
            categoryTotals[category] = 0;
            eventCounts[category] = 0;
        });
        
        // Process all events that overlap with this period
        events.forEach(event => {
            if (event.start.dateTime && event.end.dateTime) {
                const dayAllocations = divideEventAcrossDays(event, periodStart, periodEnd);
                
                dayAllocations.forEach(allocation => {
                    const category = allocation.calendarKey;
                    if (categories.includes(category)) {
                        categoryTotals[category] += allocation.duration;
                        // Count each event only once per period, not per day
                        if (allocation.dateKey === getLocalDateKey(new Date(event.start.dateTime))) {
                            eventCounts[category] += 1;
                        }
                    }
                });
            }
        });
        
        console.log(`📊 Period ${periodLabel}: category totals calculated using day-by-day allocation`);
        
        console.log(`📊 Period ${periodLabel} category totals:`, categoryTotals);
        
        aggregatedData.push({
            period: periodLabel,
            categories: categoryTotals,
            eventCounts: eventCounts
        });
    }
    
    return aggregatedData;
}

// Get category color for charts
function getCategoryColor(category) {
    const colors = {
        'prod': '#4CAF50',
        'nonprod': '#FF9800',
        'admin': '#9C27B0',
        'other': '#607D8B'
    };
    return colors[category] || '#607D8B';
}

// Get category display name
function getCategoryDisplayName(category) {
    const names = {
        'prod': 'Production Work',
        'nonprod': 'Non-Production',
        'admin': 'Admin & Rest',
        'other': 'Other Activities'
    };
    return names[category] || category;
}

// Get date range display name
function getDateRangeDisplayName() {
    const range = dateRange.value;
    const names = {
        'today': 'Today',
        'week': 'This Week',
        'month': 'This Month',
        'last1month': 'Last 30 Days',
        'quarter': 'This Quarter',
        'year': 'This Year',
        'last1year': 'Last 12 Months'
    };
    return names[range] || range;
}

// Calendar View Functions
function displayCalendar() {
    console.log('📅 Displaying calendar view for year:', currentYear);
    console.log('📅 Calendar container element:', calendarContainer);
    console.log('📅 Calendar grid element:', calendarGrid);
    updateCurrentYearDisplay();
    addTestHighlights(); // Add test highlights for debugging
    generateCalendarGrid();
}

function updateCurrentYearDisplay() {
    if (currentYearSpan) {
        currentYearSpan.textContent = currentYear;
    }
}

function navigateYear(direction) {
    currentYear += direction;
    updateCurrentYearDisplay();
    generateCalendarGrid();
}

// Responsive resize handler for calendar
let resizeTimeout;
window.addEventListener('resize', () => {
    // Debounce resize events for performance
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Regenerate calendar if screen size crosses mobile breakpoints
        const currentWidth = window.innerWidth;
        const wasMobile = currentWidth <= 768;
        const wasTinyMobile = currentWidth <= 480;
        
        // Only regenerate if we cross a breakpoint
        if (calendarGrid && calendarGrid.children.length > 0) {
            const firstHeader = calendarGrid.querySelector('.calendar-day-header');
            if (firstHeader) {
                const currentText = firstHeader.textContent;
                const shouldBeShort = wasMobile;
                const isShort = currentText.length <= 3;
                
                // Regenerate if format should change
                if (shouldBeShort !== isShort) {
                    console.log('📱 Screen size changed, regenerating calendar for responsive layout');
                    generateCalendarGrid();
                }
            }
        }
    }, 250); // 250ms debounce
});

function generateCalendarGrid() {
    console.log('📅 generateCalendarGrid called');
    console.log('📅 calendarGrid element:', calendarGrid);
    if (!calendarGrid) {
        console.error('❌ calendarGrid element not found!');
        return;
    }
    
    console.log('📅 Clearing existing calendar and generating new grid...');
    // Clear existing calendar
    calendarGrid.innerHTML = '';
    
    // Add day headers - responsive to screen size
    const dayHeaders = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayHeadersShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayHeadersMin = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    
    // Determine which header format to use based on screen width
    const isMobile = window.innerWidth <= 768;
    const isTinyMobile = window.innerWidth <= 480;
    const headerTexts = isTinyMobile ? dayHeadersShort : (isMobile ? dayHeadersShort : dayHeaders);
    
    headerTexts.forEach((day, index) => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        // Add full day name as title for accessibility
        header.title = dayHeaders[index];
        header.style.cssText = `
            background: #f8fafc;
            padding: clamp(0.4rem, 1.5vw, 0.75rem) clamp(0.15rem, 1vw, 0.5rem);
            text-align: center;
            font-weight: 600;
            color: #4a5568;
            border-bottom: 2px solid #e2e8f0;
            font-size: clamp(0.65rem, 1.8vw, 0.9rem);
        `;
        calendarGrid.appendChild(header);
    });
    
    // Generate calendar for the entire year
    for (let month = 0; month < 12; month++) {
        // Add month header
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        const monthHeader = document.createElement('div');
        monthHeader.className = 'calendar-month-header';
        monthHeader.textContent = monthNames[month] + ' ' + currentYear;
        monthHeader.style.cssText = `
            grid-column: 1 / -1;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem;
            text-align: center;
            font-weight: 700;
            font-size: 1.25rem;
            border-radius: 8px 8px 0 0;
            margin-top: ${month > 0 ? '1rem' : '0'};
        `;
        calendarGrid.appendChild(monthHeader);
        const firstDay = new Date(currentYear, month, 1);
        const lastDay = new Date(currentYear, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day other-month';
            emptyDay.innerHTML = '<div class="day-number"></div>';
            calendarGrid.appendChild(emptyDay);
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = createCalendarDay(currentYear, month, day);
            calendarGrid.appendChild(dayElement);
        }
    }
    
    console.log('✅ Calendar grid generated successfully');
}

function createCalendarDay(year, month, day) {
    const dayElement = document.createElement('div');
    const date = new Date(year, month, day);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isOtherMonth = month !== new Date().getMonth() || year !== new Date().getFullYear();
    
    dayElement.className = 'calendar-day';
    if (isToday) dayElement.classList.add('today');
    if (isOtherMonth) dayElement.classList.add('other-month');
    
    // Check for highlights only (no daily logger events in highlights tab)
    const dayHighlights = getHighlightsForDate(date);
    
    if (dayHighlights.length > 0) dayElement.classList.add('has-highlights');
    
    // Create day content
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = day;
    
    const indicators = document.createElement('div');
    indicators.className = 'day-indicators';
    
    // Add highlight indicators only (no daily logger events in highlights tab)
    dayHighlights.forEach(highlight => {
        const indicator = document.createElement('div');
        indicator.className = `day-indicator ${highlight.type}`;
        indicators.appendChild(indicator);
    });
    
    dayElement.appendChild(dayNumber);
    dayElement.appendChild(indicators);
    
    // Add click event (only highlights, no daily logger events in highlights tab)
    dayElement.addEventListener('click', () => showDayDetails(date, [], dayHighlights));
    
    return dayElement;
}

function getEventsForDate(date) {
    if (!allEvents || allEvents.length === 0) return [];
    
    const dateStr = date.toISOString().split('T')[0];
    return allEvents.filter(event => {
        if (event.start.date) {
            return event.start.date === dateStr;
        } else if (event.start.dateTime) {
            return event.start.dateTime.split('T')[0] === dateStr;
        }
        return false;
    });
}

function getHighlightsForDate(date) {
    const dateStr = date.toISOString().split('T')[0];
    const highlights = highlightsData.filter(highlight => highlight.date === dateStr);
    console.log(`📅 Checking highlights for ${dateStr}:`, highlights);
    return highlights;
}

function showDayDetails(date, events, highlights) {
    console.log('📅 Showing details for:', date.toDateString());
    
    if (dayDetailsTitle) {
        dayDetailsTitle.textContent = 'Day Details';
    }
    
    if (dayDetailsDate) {
        dayDetailsDate.textContent = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Display events
    if (dayDetailsEvents) {
        dayDetailsEvents.innerHTML = '<h3>Calendar Events</h3>';
        
        if (events.length === 0) {
            dayDetailsEvents.innerHTML += '<div class="no-events">No events scheduled for this day</div>';
        } else {
            events.forEach(event => {
                const eventElement = document.createElement('div');
                eventElement.className = 'day-details-event';
                
                const time = event.start.dateTime ? 
                    new Date(event.start.dateTime).toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    }) : 'All day';
                
                eventElement.innerHTML = `
                    <div class="day-details-event-time">${time}</div>
                    <div class="day-details-event-title">${event.summary || 'No title'}</div>
                    <div class="day-details-event-description">${event.description || ''}</div>
                `;
                
                dayDetailsEvents.appendChild(eventElement);
            });
        }
    }
    
    // Display highlights
    if (dayDetailsHighlights) {
        dayDetailsHighlights.innerHTML = '<h3>Highlights & Milestones</h3>';
        
        if (highlights.length === 0) {
            dayDetailsHighlights.innerHTML += '<div class="no-highlights">No highlights or milestones for this day</div>';
        } else {
            highlights.forEach(highlight => {
                const highlightElement = document.createElement('div');
                highlightElement.className = 'day-details-highlight';
                
                highlightElement.innerHTML = `
                    <div class="day-details-highlight-type">${highlight.type.charAt(0).toUpperCase() + highlight.type.slice(1)}</div>
                    <div class="day-details-highlight-title">${highlight.title}</div>
                    <div class="day-details-highlight-description">${highlight.description || ''}</div>
                `;
                
                dayDetailsHighlights.appendChild(highlightElement);
            });
        }
    }
    
    // Show modal
    if (dayDetailsModal) {
        dayDetailsModal.classList.remove('hidden');
    }
}

function closeDayDetailsModal() {
    if (dayDetailsModal) {
        dayDetailsModal.classList.add('hidden');
    }
}

// Google Calendar integration for highlights and milestones
let highlightsCalendarId = null;

// Create or find the highlights calendar
async function ensureHighlightsCalendar() {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }

    try {
        const calendarListResponse = await fetchWithTokenRefresh(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList'
        );

        if (calendarListResponse.ok) {
            const calendarList = await calendarListResponse.json();
            const existingCalendar = calendarList.items?.find(cal => 
                cal.summary === 'Highlights & Milestones' || 
                cal.summary === 'Diary Highlights' ||
                cal.summary?.toLowerCase().includes('highlights')
            );
            
            if (existingCalendar) {
                highlightsCalendarId = existingCalendar.id;
                console.log('✅ Found highlights calendar');
                return highlightsCalendarId;
            }
        }

        // Create new highlights calendar
        console.log('📅 Creating highlights calendar...');
        
        const createCalendarResponse = await fetchWithTokenRefresh(
            'https://www.googleapis.com/calendar/v3/calendars',
            {
                method: 'POST',
                body: JSON.stringify({
                    summary: 'Highlights & Milestones',
                    description: 'Personal highlights and milestones from Diary Analyzer',
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                })
            }
        );

        if (!createCalendarResponse.ok) {
            throw new Error(`Failed to create calendar: ${createCalendarResponse.status}`);
        }
        
        const newCalendar = await createCalendarResponse.json();
        highlightsCalendarId = newCalendar.id;
        console.log('✅ Created highlights calendar');
        return highlightsCalendarId;

    } catch (error) {
        console.error('❌ Error with highlights calendar:', error);
        throw error;
    }
}

// Save highlight to Google Calendar
async function saveHighlightToGoogleCalendar(highlight) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }

    try {
        if (!highlightsCalendarId) {
            await ensureHighlightsCalendar();
        }

        const dateString = new Date(highlight.date).toISOString().split('T')[0];

        const event = {
            summary: `⭐ ${highlight.title}`,
            description: `${highlight.description}\n\nType: ${highlight.type}\nCreated: ${highlight.createdAt}`,
            start: { date: dateString },
            end: { date: dateString },
            colorId: getColorIdForType(highlight.type)
        };

        const createEventResponse = await fetchWithTokenRefresh(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(highlightsCalendarId)}/events`,
            {
                method: 'POST',
                body: JSON.stringify(event)
            }
        );

        if (!createEventResponse.ok) {
            throw new Error(`Failed to create event: ${createEventResponse.status}`);
        }
        
        const createdEvent = await createEventResponse.json();
        console.log('✅ Highlight saved to calendar');
        return createdEvent;

    } catch (error) {
        console.error('❌ Error saving highlight:', error);
        throw error;
    }
}

// Get color ID for different highlight types
function getColorIdForType(type) {
    const colorMap = {
        'highlight': '6',    // Orange
        'milestone': '11',   // Red
        'achievement': '10', // Green
        'memory': '5'        // Yellow
    };
    return colorMap[type] || '6';
}

async function saveHighlight(highlightData) {
    if (!highlightData) {
        // Fallback to form inputs if no data provided
        const date = highlightDateInput?.value;
        const title = highlightTitleInput?.value?.trim();
        const description = highlightDescriptionInput?.value?.trim();
        const type = highlightTypeSelect?.value;
        
        if (!date || !title) {
            throw new Error('Please fill in the date and title fields.');
        }
        
        highlightData = {
            date: date,
            title: title,
            description: description,
            type: type
        };
    }
    
    const highlight = {
        id: Date.now().toString(),
        date: highlightData.date,
        title: highlightData.title,
        description: highlightData.description || '',
        type: highlightData.type,
        createdAt: new Date().toISOString()
    };
    
    try {
        // Save to Google Calendar
        await saveHighlightToGoogleCalendar(highlight);
        
        // Also save locally for backup
        highlightsData.push(highlight);
        localStorage.setItem('highlightsData', JSON.stringify(highlightsData));
        
        console.log('💾 Highlight saved to Google Calendar:', highlight);
        
    } catch (error) {
        console.error('❌ Error saving highlight to Google Calendar:', error);
        
        // Fallback to local storage only
        highlightsData.push(highlight);
        localStorage.setItem('highlightsData', JSON.stringify(highlightsData));
        
        console.log('💾 Highlight saved locally:', highlight);
    }
}

// Make functions globally available
window.closeDayDetailsModal = closeDayDetailsModal;