# AI Summary Tab Implementation for Replay Details

## Overview
Added a new "AI Summary" tab to the Replay Details page that is visible only when the `organizations:replay-ai-summaries` feature flag is enabled. The tab is positioned before the Breadcrumbs tab and makes a POST request to `/organizations/{organization_slug}/replays/summary/` to fetch AI-generated summaries.

## Changes Made

### 1. Updated TabKey Enum
**File:** `static/app/utils/replays/hooks/useActiveReplayTab.tsx`
- Added `AI_SUMMARY = 'ai-summary'` to the TabKey enum
- Added `TabKey.AI_SUMMARY` to the `supportedVideoTabs` array to ensure it works for mobile replays

### 2. Updated FocusTabs Component
**File:** `static/app/views/replays/detail/layout/focusTabs.tsx`
- Added feature flag check for `replay-ai-summaries` in the `getReplayTabs` function
- The AI Summary tab appears before Breadcrumbs when the feature flag is enabled
- Added proper TypeScript typing for the Organization parameter

### 3. Updated FocusArea Component
**File:** `static/app/views/replays/detail/layout/focusArea.tsx`
- Added case for `TabKey.AI_SUMMARY` to render the new `AISummary` component
- Imported the new `AISummary` component

### 4. Created AISummary Component
**File:** `static/app/views/replays/detail/aiSummary/index.tsx`
- **Loading State:** Shows `<LoadingIndicator>` while the API request is in flight
- **Error State:** Shows error alert if the request fails
- **Success State:** Displays the summary text from the API response
- **API Integration:** Uses Sentry's `useApi()` hook to make POST request to `/organizations/{organization_slug}/replays/summary/`
- **Feature Flag:** Only accessible when `organizations:replay-ai-summaries` is enabled
- **Styling:** Consistent with other replay detail tabs using styled components

## API Integration Details

### Endpoint
```
POST /organizations/{organization_slug}/replays/summary/
```

### Request Body
```json
{
  "replayId": "replay-id-here"
}
```

### Expected Response
```json
{
  "summary": "AI-generated summary text here"
}
```

## User Experience

1. **Feature Flag Disabled:** AI Summary tab is completely hidden
2. **Feature Flag Enabled:** AI Summary tab appears as the first tab before Breadcrumbs
3. **First Load:** Shows loading indicator while fetching summary
4. **Success:** Displays the summary text with proper formatting
5. **Error:** Shows user-friendly error message
6. **No Data:** Shows informational message when no summary is available

## Testing

The implementation includes:
- Data test ID: `replay-details-ai-summary-tab` for automated testing
- Proper error handling for API failures
- Loading states for better UX
- Feature flag integration for gradual rollout

## Dependencies

- Feature flag: `organizations:replay-ai-summaries` (already defined in `src/sentry/features/temporary.py`)
- API endpoint: `/organizations/{organization_slug}/replays/summary/` (needs backend implementation)
- Components: Uses existing Sentry UI components (`LoadingIndicator`, `Alert`, etc.)
