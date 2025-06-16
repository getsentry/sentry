# Release Bubbles UI Feature Flag Removal Summary

## Overview
Successfully removed the `release-bubbles-ui` feature flag from the Sentry codebase as it has been fully released and is no longer needed. The release bubbles UI is now the default behavior for all users.

## Changes Made

### Backend Changes
- **`src/sentry/features/temporary.py`**: Removed the feature flag definition for `organizations:release-bubbles-ui`

### Frontend Changes

#### 1. **`static/app/components/version.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Now always uses the new release drawer (`makeReleaseDrawerPathname`) instead of the old releases page
- Removed unused `makeReleasesPathname` import

#### 2. **`static/app/components/replays/releaseDropdownFilter.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Now always navigates to the release drawer for release details
- Removed unused `makeReleasesPathname` import

#### 3. **`static/app/views/issueDetails/streamline/eventGraph.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Simplified logic to always enable release bubbles when `showReleasesAs !== 'line'`

#### 4. **`static/app/views/releases/releaseBubbles/useReleaseBubbles.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Always enable release bubbles functionality when releases/flags are present
- Removed unused `useOrganization` import and `organization` variable

#### 5. **`static/app/views/performance/transactionSummary/transactionOverview/useWidgetChartVisualization.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Always enable release bubbles props (`{releases, showReleaseAs: 'bubble'}`)
- Removed unused `useOrganization` import and `organization` variable

#### 6. **`static/app/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Always use release bubbles when `showReleaseAs === 'bubble'`
- Always use the new release drawer for release clicks
- Removed unused `useOrganization` import, `organization` variable, and `makeReleasesPathname` import

#### 7. **`static/app/views/insights/pages/platform/shared/getReleaseBubbleProps.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Always return release bubbles props instead of empty object
- Removed unused `useOrganization` import and `organization` variable

#### 8. **`static/app/views/insights/common/components/insightsTimeSeriesWidget.tsx`**
- Removed feature flag check for `release-bubbles-ui`
- Always enable release bubbles props for insights widgets

## Behavioral Changes

### Before (with feature flag)
- Users with the `release-bubbles-ui` flag enabled saw:
  - Release bubbles on charts instead of release lines
  - New release drawer when clicking on releases
- Users without the flag saw:
  - Release lines on charts
  - Old release details page when clicking on releases

### After (flag removed)
- All users now see:
  - Release bubbles on charts (when `showReleaseAs === 'bubble'`)
  - New release drawer for all release interactions
  - Consistent release bubbles functionality across all components

## Impact
- **No breaking changes**: The "new" behavior (release bubbles UI) is now the default for all users
- **Improved consistency**: All users now have the same modern release visualization experience
- **Code simplification**: Removed conditional logic and unused imports throughout the codebase
- **Performance**: Slightly improved performance by removing unnecessary feature flag checks

## Files Modified
- 1 backend file (Python)
- 8 frontend files (TypeScript/React)
- All linter errors have been resolved

The release bubbles UI feature is now permanently enabled for all organizations and users.
