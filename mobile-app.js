// Mobile-specific JavaScript for Diary Analyzer
// Enhanced mobile interactions and framework integration

// Mobile Framework Integration
class MobileApp {
    constructor() {
        this.currentView = 'distribution';
        this.isModalOpen = false;
        this.init();
    }

    init() {
        this.setupMobileNavigation();
        this.setupMobileModals();
        this.setupMobileGestures();
        this.setupMobileBottomNav();
        this.setupMobileFormHandlers();
    }

    // Mobile Navigation Setup
    setupMobileNavigation() {
        // Handle mobile bottom navigation
        const bottomNavItems = document.querySelectorAll('.mobile-bottom-nav-item');
        bottomNavItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                const action = item.dataset.action;
                
                if (view) {
                    this.switchView(view);
                    this.updateBottomNavActive(item);
                } else if (action === 'random-recap') {
                    this.openRandomRecapModal();
                }
            });
        });
    }

    // Mobile Modal Management
    setupMobileModals() {
        // Random Recap Modal
        const randomRecapModal = document.getElementById('randomRecapModal');
        const randomRecapClose = document.querySelector('.mobile-modal-close');
        
        if (randomRecapClose) {
            randomRecapClose.addEventListener('click', () => {
                this.closeRandomRecapModal();
            });
        }

        // Close modal when clicking outside
        if (randomRecapModal) {
            randomRecapModal.addEventListener('click', (e) => {
                if (e.target === randomRecapModal) {
                    this.closeRandomRecapModal();
                }
            });
        }
    }

    // Mobile Gesture Support
    setupMobileGestures() {
        // Swipe gestures for timeline navigation
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
            this.handleSwipe(startX, startY, endX, endY);
        });
    }

    // Mobile Bottom Navigation
    setupMobileBottomNav() {
        // This is handled in setupMobileNavigation
    }

    // Mobile Form Handlers
    setupMobileFormHandlers() {
        // Handle form submissions with mobile-optimized feedback
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit(form);
            });
        });

        // Handle select changes with mobile feedback
        const selects = document.querySelectorAll('.mobile-form-select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                this.handleSelectChange(select);
            });
        });
    }

    // View Switching
    switchView(viewName) {
        // Hide all views
        const views = ['timelineContainer', 'distributionContainer', 'advancedContainer'];
        views.forEach(viewId => {
            const element = document.getElementById(viewId);
            if (element) {
                element.classList.add('mobile-hidden');
            }
        });

        // Show selected view
        const selectedView = document.getElementById(viewName + 'Container');
        if (selectedView) {
            selectedView.classList.remove('mobile-hidden');
            this.currentView = viewName;
        }

        // Update view mode selector
        const viewModeSelect = document.getElementById('viewMode');
        if (viewModeSelect) {
            viewModeSelect.value = viewName;
        }

        // Call the appropriate display function directly
        if (viewName === 'timeline') {
            if (typeof window.displayTimeline === 'function') {
                window.displayTimeline();
            } else if (typeof displayTimeline === 'function') {
                displayTimeline();
            }
        } else if (viewName === 'distribution') {
            if (typeof window.displayDistribution === 'function') {
                window.displayDistribution();
            } else if (typeof displayDistribution === 'function') {
                displayDistribution();
            }
        } else if (viewName === 'advanced') {
            if (typeof window.displayAdvancedAnalytics === 'function') {
                window.displayAdvancedAnalytics();
            } else if (typeof displayAdvancedAnalytics === 'function') {
                displayAdvancedAnalytics();
            }
        }
    }

    // Update Bottom Navigation Active State
    updateBottomNavActive(activeItem) {
        const allItems = document.querySelectorAll('.mobile-bottom-nav-item');
        allItems.forEach(item => {
            item.classList.remove('active');
        });
        activeItem.classList.add('active');
    }

    // Modal Management
    openRandomRecapModal() {
        const modal = document.getElementById('randomRecapModal');
        if (modal) {
            modal.classList.remove('mobile-hidden');
            modal.classList.add('active');
            this.isModalOpen = true;
            document.body.style.overflow = 'hidden';
        }
    }

    closeRandomRecapModal() {
        const modal = document.getElementById('randomRecapModal');
        if (modal) {
            modal.classList.add('mobile-hidden');
            modal.classList.remove('active');
            this.isModalOpen = false;
            document.body.style.overflow = '';
        }
    }

    // Swipe Gesture Handling
    handleSwipe(startX, startY, endX, endY) {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const minSwipeDistance = 50;

        // Only handle horizontal swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                // Swipe right - go to previous day
                this.navigateToPreviousDay();
            } else {
                // Swipe left - go to next day
                this.navigateToNextDay();
            }
        }
    }

    // Navigation Methods
    navigateToPreviousDay() {
        const prevBtn = document.getElementById('prevDay');
        if (prevBtn) {
            prevBtn.click();
        }
    }

    navigateToNextDay() {
        const nextBtn = document.getElementById('nextDay');
        if (nextBtn) {
            nextBtn.click();
        }
    }

    // Form Handling
    handleFormSubmit(form) {
        // Add mobile-specific form submission handling
        console.log('Mobile form submitted:', form);
    }

    handleSelectChange(select) {
        // Add mobile-specific select change handling
        console.log('Mobile select changed:', select.value);
    }

    // Mobile-specific utility methods
    showMobileToast(message, type = 'info') {
        // Create and show a mobile toast notification
        const toast = document.createElement('div');
        toast.className = `mobile-toast mobile-toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Mobile Timeline Rendering
    renderMobileTimeline(events) {
        const timeline = document.getElementById('timeline');
        if (!timeline) return;

        timeline.innerHTML = '';

        if (events.length === 0) {
            timeline.innerHTML = `
                <div class="mobile-text-center mobile-p-8">
                    <p class="mobile-text-gray-500">No events found for this day</p>
                </div>
            `;
            return;
        }

        events.forEach(event => {
            const timelineItem = this.createMobileTimelineItem(event);
            timeline.appendChild(timelineItem);
        });
    }

    createMobileTimelineItem(event) {
        const item = document.createElement('div');
        item.className = 'mobile-timeline-item';
        
        const startTime = new Date(event.start.dateTime || event.start.date);
        const endTime = new Date(event.end.dateTime || event.end.date);
        const timeString = this.formatTimeRange(startTime, endTime);
        
        item.innerHTML = `
            <div class="mobile-timeline-time">${timeString}</div>
            <div class="mobile-timeline-title">${event.summary || 'No Title'}</div>
            ${event.description ? `<div class="mobile-timeline-description">${event.description}</div>` : ''}
        `;
        
        return item;
    }

    formatTimeRange(start, end) {
        const startTime = start.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        const endTime = end.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
        return `${startTime} - ${endTime}`;
    }

    // Mobile Stats Rendering
    renderMobileStats(stats) {
        const totalEvents = document.getElementById('totalEvents');
        const activeHours = document.getElementById('activeHours');
        const mostCommon = document.getElementById('mostCommon');

        if (totalEvents) totalEvents.textContent = stats.totalEvents || 0;
        if (activeHours) activeHours.textContent = stats.activeHours || '0h 0m';
        if (mostCommon) mostCommon.textContent = stats.mostCommon || '-';
    }

    // Mobile Chart Rendering
    renderMobileChart(containerId, chartData) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Mobile-optimized chart rendering
        const chartContent = container.querySelector('.mobile-chart-content');
        if (chartContent) {
            chartContent.innerHTML = '<canvas id="mobileChart"></canvas>';
            
            // Initialize Chart.js with mobile-optimized settings
            const ctx = document.getElementById('mobileChart').getContext('2d');
            new Chart(ctx, {
                type: 'doughnut',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true
                            }
                        }
                    }
                }
            });
        }
    }
}

// Mobile-specific CSS for toast notifications
const mobileToastCSS = `
.mobile-toast {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 500;
    z-index: 9999;
    animation: mobileToastSlideDown 0.3s ease-out;
}

.mobile-toast-success {
    background: rgba(16, 185, 129, 0.9);
}

.mobile-toast-error {
    background: rgba(239, 68, 68, 0.9);
}

.mobile-toast-warning {
    background: rgba(245, 158, 11, 0.9);
}

@keyframes mobileToastSlideDown {
    from {
        transform: translateX(-50%) translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
}
`;

// Inject mobile toast CSS
const style = document.createElement('style');
style.textContent = mobileToastCSS;
document.head.appendChild(style);

// Initialize mobile app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for the main app to initialize
    setTimeout(() => {
        window.mobileApp = new MobileApp();
        console.log('📱 Mobile app initialized');
    }, 100);
});

// Global functions for backward compatibility
function closeRandomRecapModal() {
    if (window.mobileApp) {
        window.mobileApp.closeRandomRecapModal();
    }
}

// Export for use in main app.js
window.MobileApp = MobileApp;