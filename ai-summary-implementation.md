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
- **API Integration:** Uses Sentry's `useApiQuery()` hook with proper query key configuration for POST requests
- **Caching:** Implements 5-minute stale time for efficient caching
- **Conditional Fetching:** Only makes requests when replay record is available
- **Feature Flag:** Only accessible when `organizations:replay-ai-summaries` is enabled
- **Styling:** Consistent with other replay detail tabs using styled components

## API Integration Details

### Query Key Structure
```typescript
function createAISummaryQueryKey(orgSlug: string, replayId: string): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/replays/summary/`,
    {
      method: 'POST',
      data: {
        replayId,
      },
    },
  ];
}
```

### useApiQuery Configuration
```typescript
const {data, isLoading, isError} = useApiQuery<SummaryResponse>(
  createAISummaryQueryKey(organization.slug, replayRecord?.id ?? ''),
  {
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: Boolean(replayRecord?.id),
  }
);
```

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

## Benefits of useApiQuery Implementation

1. **Automatic Caching:** Built-in caching with 5-minute stale time prevents unnecessary requests
2. **Request Deduplication:** Multiple components requesting the same data will share a single request
3. **Background Refetching:** Automatic background updates when data becomes stale
4. **Conditional Fetching:** Only makes requests when replay record is available
5. **Error Handling:** Built-in error states and retry logic
6. **Loading States:** Automatic loading state management
7. **TypeScript Safety:** Full type safety with TypeScript generics

## User Experience

1. **Feature Flag Disabled:** AI Summary tab is completely hidden
2. **Feature Flag Enabled:** AI Summary tab appears as the first tab before Breadcrumbs
3. **First Load:** Shows loading indicator while fetching summary
4. **Success:** Displays the summary text with proper formatting
5. **Error:** Shows user-friendly error message
6. **No Data:** Shows informational message when no summary is available
7. **Subsequent Visits:** Cached data loads instantly within 5-minute window

## Testing

The implementation includes:
- Data test ID: `replay-details-ai-summary-tab` for automated testing
- Proper error handling for API failures
- Loading states for better UX
- Feature flag integration for gradual rollout
- Conditional fetching to prevent unnecessary requests

## Dependencies

- Feature flag: `organizations:replay-ai-summaries` (already defined in `src/sentry/features/temporary.py`)
- API endpoint: `/organizations/{organization_slug}/replays/summary/` (needs backend implementation)
- Components: Uses existing Sentry UI components (`LoadingIndicator`, `Alert`, etc.)
- Query Client: Uses Sentry's `useApiQuery` hook for data fetching and caching
