# Workout Tracking Updates

## Summary
Successfully implemented workout tracking features with calendar visualization and score graphing capabilities.

## Database Changes

### New Migration: `002_workout_tracking.sql`

Created two new tables:

#### 1. `workout_requests` Table
- **Purpose**: Store workout session data with approval workflow
- **Key Columns**:
  - `user_id`: References auth.users
  - `partner_id`: References auth.users (for partner tracking)
  - `note`: Text field for workout notes
  - `status`: ENUM ('pending', 'approved', 'rejected')
  - `recorded_at`: Timestamp with timezone (UTC)
  - `created_at`, `updated_at`: Automatic timestamps

- **Indexes**:
  - `user_id`, `partner_id`, `status`, `recorded_at` for fast queries

- **Row Level Security**:
  - Users can view their own and partner's requests
  - Users can insert/update/delete their own requests

#### 2. `workout_scores` Table
- **Purpose**: Track workout scores over time
- **Key Columns**:
  - `user_id`: References auth.users
  - `score`: Numeric(10, 2) for score values
  - `recorded_at`: Timestamp with timezone (UTC)
  - `created_at`, `updated_at`: Automatic timestamps

- **Indexes**:
  - `user_id`, `recorded_at`, and composite index for efficient querying

- **Row Level Security**:
  - Users can view their own scores and partner's scores (if related via workout_requests)
  - Users can insert/update/delete their own scores

## Frontend Changes

### 1. Configuration Updates (`config.js`)
- Added Supabase configuration:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

### 2. HTML Updates (`index.html`)
- Added Supabase SDK script tag
- Added new "Score Graph" option to Analytics view mode selector
- Created new Score Graph container with:
  - Time range selector (7 days to 1 year)
  - Refresh button
  - Chart canvas area

### 3. JavaScript Updates (`app.js`)

#### Supabase Integration
- Initialized Supabase client on app load
- Created functions to fetch data from Supabase tables

#### Calendar View Updates
- **`fetchWorkoutRequests()`**: Fetches approved workout requests from database
- **`getWorkoutRequestsForDate(date)`**: Filters workouts by date with timezone conversion
  - Converts UTC timestamps to local timezone
  - Returns workouts for specific calendar date
- **`createCalendarDay()`**: Updated to show workout indicators
  - Displays green indicators for days with approved workouts
  - Shows workout data on click
- **`showDayDetails()`**: Updated to display workout notes
  - Shows workout session time (converted to local timezone)
  - Displays workout notes from the `note` column

#### Score Graph Feature
- **`fetchWorkoutScores(days)`**: Fetches scores for specified time range
- **`displayScoreGraph()`**: Renders line chart using Chart.js
  - X-axis: Date
  - Y-axis: Score
  - Interactive tooltips
  - Responsive design
  - Different colors for user vs partner (ready for multi-user)

#### View Mode Switching
- Updated `displayCurrentView()` to include score graph option
- Added event listeners for score graph controls

### 4. CSS Updates (`styles.css`)
- Added `.score-graph-container` styles
- Added `.score-graph-controls` for layout
- Added `.score-graph-chart` for chart container
- Added `.day-indicator.workout` for workout indicators (green gradient)
- Mobile responsive styles for score graph

## Key Features Implemented

### ✅ Calendar View Fixes
1. **Data Source**: Changed from Google Calendar events to `workout_requests` table
2. **Status Filter**: Only shows workouts with `status = 'approved'`
3. **Timezone Handling**: Converts UTC timestamps to local device timezone
4. **Click Content**: Shows `note` column content when calendar day is clicked

### ✅ Score Graph View
1. **Time Range Selection**: 7 days to 1 year
2. **Line Chart Visualization**: Using Chart.js
3. **User/Partner Distinction**: Ready for multi-color support
4. **Interactive Features**: Hover tooltips, responsive design

### ✅ Removed Components
- No "total progress" component found in codebase (was already absent)
- No database table to remove (marked as N/A)

## Timezone Conversion Details

The app performs timezone conversion in two places:

1. **Calendar Day Matching**:
   ```javascript
   const recordedDate = new Date(request.recorded_at); // UTC from DB
   const recordedLocalDateStr = recordedDate.toLocaleDateString('en-CA'); // Local date
   ```

2. **Display Time**:
   ```javascript
   const recordedDate = new Date(workout.recorded_at);
   const time = recordedDate.toLocaleTimeString('en-US', { 
       hour: '2-digit', 
       minute: '2-digit' 
   });
   ```

This ensures workouts recorded at 11 PM in UTC but 6 PM local time appear on the correct local date.

## Database Migration Instructions

To apply the new migration:

```bash
# Using Supabase CLI
supabase db push

# Or directly in Supabase Dashboard
# Navigate to: SQL Editor → New Query
# Paste contents of: backend/supabase/migrations/002_workout_tracking.sql
# Execute
```

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Calendar view shows workout indicators
- [ ] Clicking calendar day shows workout notes
- [ ] Timezone conversion works correctly
- [ ] Score graph displays when selected
- [ ] Time range selector updates graph
- [ ] Mobile responsive design works
- [ ] RLS policies prevent unauthorized access

## Future Enhancements

1. **Multi-User Score Tracking**: Add logic to distinguish user from partner scores
2. **Score Entry Form**: Add UI to input new scores
3. **Workout Request Form**: Add UI to create/approve workout requests
4. **Notifications**: Alert when partner adds workout
5. **Statistics**: Show average scores, trends, achievements

## Files Modified

1. `backend/supabase/migrations/002_workout_tracking.sql` - NEW
2. `config.js` - Added Supabase config
3. `index.html` - Added Score Graph view, Supabase SDK
4. `app.js` - Added workout/score fetching, calendar updates, graph rendering
5. `styles.css` - Added score graph and workout indicator styles
6. `WORKOUT_TRACKING_UPDATES.md` - NEW (this file)

## Notes

- All changes maintain backward compatibility
- Google Calendar functionality remains intact
- Supabase client initialization is graceful (won't break if SDK not loaded)
- All database queries use RLS for security
- Timezone handling respects user's device timezone
