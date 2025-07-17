# 📊 Diary Analyzer Chrome Extension

A beautiful Chrome extension that transforms your Google Calendar diary entries into clean, insightful visualizations. Perfect for tracking your daily activities, productivity patterns, and time allocation across different projects.

![Diary Analyzer Preview](https://img.shields.io/badge/Chrome%20Extension-Diary%20Analyzer-blue?style=for-the-badge&logo=google-chrome)

## ✨ Features

### 📈 **Dual Visualization Modes**
- **Timeline View**: Detailed chronological display of your daily activities
- **Distribution View**: Time allocation analysis across different calendar categories

### 🎨 **Beautiful UI**
- Modern gradient design with smooth animations
- Responsive layout optimized for Chrome extension popup
- Color-coded activity categories with hover tooltips
- Clean, professional interface

### 📊 **Advanced Analytics**
- **Daily Distribution**: Horizontal bar charts showing time spent per calendar
- **Weekly/Monthly Stacked Charts**: Vertical bars comparing productivity across dates
- **Smart Categorization**: Automatically groups activities (Production, Non-Production, Admin & Rest)
- **Real-time Statistics**: Total events, active hours, most common activities

### 🗓️ **Multi-Calendar Support**
- Fetches data from multiple Google Calendar sources
- Perfect for users with organized calendar systems (e.g., "Actual Diary - Prod", "Actual Diary - Admin")
- Timezone-aware date handling for accurate local time display

### 🔧 **Smart Features**
- Date navigation with automatic data refresh
- Flexible time range selection (Today, This Week, This Month)
- Intelligent event categorization based on titles
- Secure local token storage

## 🚀 Quick Start

### Prerequisites
- Google account with Google Calendar
- Chrome browser
- Google Cloud Platform account (free tier sufficient)

### Installation

1. **Clone the repository**
   ```bash
   git clone git@github.com:JunjieYu95/DiaryAnalyzer.git
   cd DiaryAnalyzer
   ```

2. **Set up Google Calendar API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Calendar API
   - Create OAuth 2.0 credentials for Chrome Extension
   - Note down your Client ID

3. **Configure the extension**
   ```bash
   # Copy the template manifest
   cp manifest.template.json manifest.json
   
   # Edit manifest.json and replace YOUR_GOOGLE_OAUTH_CLIENT_ID_HERE with your actual Client ID
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the DiaryAnalyzer folder
   - Copy the extension ID from Chrome

5. **Update OAuth settings**
   - Return to Google Cloud Console
   - Add your extension ID to OAuth redirect URIs:
     - `https://[YOUR_EXTENSION_ID].chromiumapp.org/`

## 📱 Usage

### Getting Started
1. Click the Diary Analyzer icon in Chrome toolbar
2. Click "Connect Calendar" to authenticate
3. Grant permissions to read your Google Calendar
4. Start exploring your data!

### View Modes

#### **Timeline View** (Today)
Perfect for detailed daily review:
- See all activities in chronological order
- View duration and time ranges
- Check which calendar each event belongs to
- Color-coded activity categories

#### **Distribution View**
Ideal for productivity analysis:

**Today**: Horizontal bars showing time allocation
- Production Work (Green)
- Non-Production (Blue)  
- Admin & Rest (Orange)
- Other Activities (Gray)

**Week/Month**: Stacked bar charts
- X-axis: Dates
- Y-axis: Time spent (scaled to busiest day)
- Stacked segments show category breakdown
- Hover for detailed time information

### Navigation
- **Date arrows**: Navigate day by day
- **Date range selector**: Switch between Today/Week/Month
- **View mode toggle**: Switch between Timeline and Distribution
- **Refresh button**: Reload latest calendar data

## 🔧 Configuration

### Calendar Organization
The extension works best with organized calendar structure:
- **Primary Calendar**: Personal activities
- **Actual Diary - Prod**: Production work
- **Actual Diary - Nonprod**: Development/testing
- **Actual Diary - Admin**: Administrative tasks and rest

### Customization
You can modify the categorization logic in `popup.js`:
```javascript
function getCalendarKey(calendarName) {
    // Customize calendar grouping logic here
}
```

## 🏗️ Technical Architecture

### File Structure
```
DiaryAnalyzer/
├── popup.html              # Main UI interface
├── popup.css               # Styling and animations
├── popup.js                # Core functionality and API integration
├── manifest.template.json  # Chrome extension configuration template
├── icons/                  # Extension icons (16px, 48px, 128px)
├── SETUP_GUIDE.md         # Detailed setup instructions
└── README.md              # This file
```

### Key Technologies
- **Chrome Extensions API**: Identity and storage
- **Google Calendar API v3**: Calendar data access
- **Vanilla JavaScript**: Core functionality
- **CSS3**: Modern styling with flexbox/grid
- **Local Storage**: Secure token management

## 🔒 Security & Privacy

### Data Handling
- **Read-only access**: Only requests calendar viewing permissions
- **Local storage**: Authentication tokens stored locally in Chrome
- **No external servers**: All processing happens locally
- **Secure OAuth**: Uses Google's standard OAuth 2.0 flow

### Sensitive Files Protection
The following files are excluded from the repository:
- `manifest.json` (contains your OAuth client ID)
- `private/` directory (any secret files)
- OAuth client secrets and API keys

## 🐛 Troubleshooting

### Common Issues

**"Authentication failed"**
- Verify OAuth client ID in manifest.json
- Check extension ID matches Google Cloud Console settings
- Ensure Google Calendar API is enabled

**"No events showing"**
- Confirm events exist in your Google Calendar
- Check date range selection
- Try refreshing data

**Timezone issues**
- Extension automatically uses your local timezone
- Verify your system timezone is correct

### Debug Mode
Open Chrome DevTools (Right-click extension → Inspect) to see detailed logs:
- Authentication status
- API responses
- Timezone information
- Event processing details

## 🛣️ Roadmap

### Upcoming Features
- [ ] Export functionality (CSV, PDF reports)
- [ ] More visualization types (pie charts, trend analysis)
- [ ] Custom time range selection
- [ ] Goal setting and progress tracking
- [ ] Integration with other calendar providers
- [ ] Dark mode theme
- [ ] Keyboard shortcuts

### Version History
- **v1.0.0**: Initial release with dual visualization modes
- **v1.0.1**: Timezone fixes and improved stacked charts
- **v1.0.2**: Enhanced multi-calendar support

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Calendar API for robust calendar access
- Chrome Extensions platform for seamless integration
- Open source community for inspiration and tools

## 📞 Support

If you encounter any issues or have questions:
1. Check the [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
2. Review the troubleshooting section above
3. Open an issue on GitHub
4. Check Chrome extension console for error details

---

**Made with ❤️ for productivity enthusiasts who love data-driven insights into their daily lives.** 