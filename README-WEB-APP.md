# 📊 Diary Analyzer - Web Application

A beautiful, modern web application that transforms your Google Calendar diary entries into clean, insightful visualizations. Perfect for tracking your daily activities, productivity patterns, and time allocation across different projects.

![Diary Analyzer Web App](https://img.shields.io/badge/Web%20App-Diary%20Analyzer-blue?style=for-the-badge&logo=google-chrome)

## ✨ Features

### 🎨 **Modern Web Interface**
- Beautiful gradient design with glassmorphism effects
- Fully responsive layout optimized for all devices
- Smooth animations and hover effects
- Professional, clean interface

### 📈 **Multiple Visualization Modes**
- **Timeline View**: Detailed chronological display of your daily activities
- **Distribution View**: Time allocation analysis across different calendar categories
- **Advanced Analytics**: Interactive charts and comprehensive data analysis

### 🔐 **Secure Google Authentication**
- Direct Google OAuth 2.0 integration
- One-click sign-in with Google account
- Secure token management
- Read-only calendar access

### 📊 **Advanced Analytics**
- **Daily Distribution**: Horizontal bar charts showing time spent per calendar
- **Weekly/Monthly Stacked Charts**: Vertical bars comparing productivity across dates
- **Smart Categorization**: Automatically groups activities (Production, Non-Production, Admin & Rest)
- **Real-time Statistics**: Total events, active hours, most common activities

### 🗓️ **Multi-Calendar Support**
- Fetches data from multiple Google Calendar sources
- Perfect for users with organized calendar systems
- Timezone-aware date handling for accurate local time display

### 🔧 **Smart Features**
- Date navigation with automatic data refresh
- Flexible time range selection (Today, Week, Month, Quarter, Year)
- Intelligent event categorization based on titles
- Local storage for session persistence

## 🚀 Quick Start

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Google account with Google Calendar
- Google Cloud Platform account (free tier sufficient)

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd diary-analyzer-web-app
   ```

2. **Set up Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials for Web Application
   - Note down your Client ID and API Key

3. **Configure the application**
   - Open `index.html`
   - Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual Client ID
   - Replace `YOUR_GOOGLE_API_KEY_HERE` in `app.js` with your actual API Key

4. **Run the application**
   ```bash
   # Using Python (recommended)
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   
   # Or using any other local server
   ```

5. **Access the application**
   - Open your browser and go to `http://localhost:8000`
   - Click "Sign in with Google"
   - Grant permissions to read your calendar
   - Start exploring your data!

## 📱 Usage

### Getting Started
1. Open the web application in your browser
2. Click "Sign in with Google" to authenticate
3. Grant permissions to read your Google Calendar
4. Start exploring your data with different views!

### View Modes

#### **Timeline View**
Perfect for detailed daily review:
- See all activities in chronological order
- View duration and time ranges
- Check which calendar each event belongs to
- Color-coded activity categories

#### **Distribution View**
Ideal for productivity analysis:

**Today**: Horizontal bars showing time allocation
- Production Work (Green)
- Non-Production (Gray)  
- Admin & Rest (Orange)
- Other Activities (Light Gray)

**Week/Month**: Stacked bar charts
- X-axis: Dates
- Y-axis: Time spent (scaled to busiest day)
- Stacked segments show category breakdown
- Hover for detailed time information

#### **Advanced Analytics**
Comprehensive data analysis:
- Interactive time series charts
- Category distribution over time
- Trend analysis and insights

### Navigation
- **Date arrows**: Navigate day by day
- **Date range selector**: Switch between Today/Week/Month/Quarter/Year
- **View mode toggle**: Switch between Timeline, Distribution, and Advanced Analytics
- **Refresh button**: Reload latest calendar data

## 🔧 Configuration

### Google Cloud Console Setup

1. **Create OAuth 2.0 Credentials**
   - Application type: "Web application"
   - Name: "Diary Analyzer Web App"
   - Authorized JavaScript origins: `http://localhost:8000` (for development)
   - Authorized redirect URIs: `http://localhost:8000` (for development)

2. **Enable APIs**
   - Google Calendar API
   - Google Identity Services API

3. **Configure OAuth Consent Screen**
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in required fields
   - Add your email as a test user

### Calendar Organization
The application works best with organized calendar structure:
- **Primary Calendar**: Personal activities
- **Actual Diary - Prod**: Production work
- **Actual Diary - Nonprod**: Development/testing
- **Actual Diary - Admin**: Administrative tasks and rest

### Customization
You can modify the categorization logic in `app.js`:
```javascript
function getCalendarKey(calendarName) {
    // Customize calendar grouping logic here
}
```

## 🏗️ Technical Architecture

### File Structure
```
diary-analyzer-web-app/
├── index.html              # Main application entry point
├── styles.css              # Modern CSS with glassmorphism effects
├── app.js                  # Core functionality and API integration
├── package.json            # Dependencies and scripts
├── README-WEB-APP.md      # This documentation
└── assets/                 # Icons and other assets (if any)
```

### Key Technologies
- **Google Identity Services**: Modern OAuth 2.0 authentication
- **Google Calendar API v3**: Calendar data access
- **Vanilla JavaScript**: Core functionality
- **CSS3**: Modern styling with flexbox/grid and glassmorphism
- **Chart.js**: Interactive data visualizations
- **Local Storage**: Secure token management

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 🔒 Security & Privacy

### Data Handling
- **Read-only access**: Only requests calendar viewing permissions
- **Local storage**: Authentication tokens stored locally in browser
- **No external servers**: All processing happens client-side
- **Secure OAuth**: Uses Google's modern Identity Services

### Privacy Protection
- No data is sent to external servers
- All calendar data processing happens in your browser
- Tokens are stored securely in browser's local storage
- You can revoke access anytime through Google Account settings

## 🐛 Troubleshooting

### Common Issues

**"Authentication failed"**
- Verify OAuth client ID in `index.html`
- Check that your domain is added to authorized origins
- Ensure Google Calendar API is enabled

**"No events showing"**
- Confirm events exist in your Google Calendar
- Check date range selection
- Try refreshing data
- Verify calendar permissions

**"API errors"**
- Check that Google Calendar API is enabled
- Verify API key is correct in `app.js`
- Ensure proper OAuth consent screen configuration

### Debug Mode
Open browser DevTools (F12) to see detailed logs:
- Authentication status
- API responses
- Timezone information
- Event processing details

## 🛣️ Roadmap

### Upcoming Features
- [ ] Export functionality (CSV, PDF reports)
- [ ] More visualization types (pie charts, heatmaps)
- [ ] Custom time range selection
- [ ] Goal setting and progress tracking
- [ ] Integration with other calendar providers
- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] Offline support with service workers
- [ ] Mobile app (PWA)

### Version History
- **v1.0.0**: Initial web application release
- **v1.0.1**: Enhanced responsive design
- **v1.0.2**: Improved Google OAuth integration

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Guidelines
- Follow existing code style
- Add comments for complex functionality
- Test with multiple calendar configurations
- Update documentation as needed
- Ensure responsive design works on all devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Identity Services for modern OAuth integration
- Google Calendar API for robust calendar access
- Chart.js for beautiful data visualizations
- Open source community for inspiration and tools

## 📞 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Review browser console for error details
3. Open an issue on GitHub
4. Verify Google Cloud Console configuration

---

**Made with ❤️ for productivity enthusiasts who love data-driven insights into their daily lives.**

## 🔄 Migration from Chrome Extension

If you're migrating from the Chrome Extension version:

1. **Data**: Your calendar data will be fetched fresh (no migration needed)
2. **Authentication**: You'll need to sign in again with the web app
3. **Settings**: Any customizations will need to be re-applied
4. **Features**: The web app includes all extension features plus additional ones

The web application provides a more modern, accessible, and feature-rich experience compared to the Chrome extension version.