# Plan: Add Updated Replay Duration to Playback Speed Options

## Overview
Add adjusted replay duration display next to each playback speed option in the Replay Details page Settings dropdown. For example, if a replay duration is 20 minutes and the playback speed is 2x, show "10 minutes" next to the 2x option.

## Current Implementation Analysis

### Key Components
1. **ReplayPreferenceDropdown** (`/static/app/components/replays/preferences/replayPreferenceDropdown.tsx`)
   - Contains the Settings gear icon dropdown
   - Manages playback speed options using `CompositeSelect.Region`
   - Currently displays speed options as `${option}x` (e.g., "0.1x", "0.25x", "1x", "2x")

2. **ReplayController** (`/static/app/components/replays/replayController.tsx`)
   - Contains the `ReplayPreferenceDropdown` component
   - Defines default speed options: `[0.1, 0.25, 0.5, 1, 2, 4, 8, 16]`

3. **Duration Access**
   - Replay duration is available via `useReplayContext()` hook
   - `replay.getDurationMs()` returns duration in milliseconds
   - Duration formatting is handled by `Duration` component from `sentry/components/duration/duration`

## Implementation Plan

### Step 1: Modify ReplayPreferenceDropdown Component

**File**: `/static/app/components/replays/preferences/replayPreferenceDropdown.tsx`

**Changes**:
1. Import `useReplayContext` to access replay duration
2. Import `Duration` component for consistent formatting
3. Create a helper function to calculate adjusted duration
4. Modify the speed options mapping to include duration display
5. Only show duration when replay data is loaded (not fetching)

**Key Logic**:
```typescript
// Calculate adjusted duration for each speed
const calculateAdjustedDuration = (originalDurationMs: number, speed: number) => {
  return originalDurationMs / speed;
};

// Check if we should show duration (data is loaded and duration is available)
const shouldShowDuration = !isLoading && !isFetching && replay && replay.getDurationMs() > 0;
```

**Option Label Format**:
- When duration is available: `"2x (10:00)"`
- When duration is not available: `"2x"` (current behavior)

### Step 2: Update Option Rendering Logic

**Current**:
```typescript
options={speedOptions.map(option => ({
  label: `${option}x`,
  value: option,
}))}
```

**New**:
```typescript
options={speedOptions.map(option => {
  const baseLabel = `${option}x`;

  if (shouldShowDuration) {
    const adjustedDurationMs = calculateAdjustedDuration(replay.getDurationMs(), option);
    const durationDisplay = formatDuration({
      duration: [adjustedDurationMs, 'ms'],
      precision: 'sec',
      style: 'mm:ss'
    });
    return {
      label: `${baseLabel} (${durationDisplay})`,
      value: option,
    };
  }

  return {
    label: baseLabel,
    value: option,
  };
})}
```

### Step 3: Handle Edge Cases

**Considerations**:
1. **Loading State**: Don't show duration when `isLoading` or `isFetching` is true
2. **Zero Duration**: Don't show duration if `replay.getDurationMs()` returns 0 or undefined
3. **Performance**: Calculations are lightweight (simple division), no memoization needed
4. **Formatting**: Use existing duration formatting utilities for consistency
5. **Accessibility**: Ensure screen readers can properly read the duration information

### Step 4: Styling Considerations

**Current UI**: Uses `CompositeSelect.Region` which handles option styling automatically

**Potential Enhancements** (if needed):
- Duration text could be styled with a lighter color to differentiate from speed
- Consider truncating very long durations or using abbreviated format for compact display

### Step 5: Testing Strategy

**Unit Tests**:
- Test duration calculation for various speeds
- Test that duration only shows when data is available
- Test edge cases (zero duration, very long durations, decimal speeds)

**Manual Testing**:
- Verify behavior during loading state
- Test with various replay durations (short, medium, long)
- Verify accessibility with screen readers
- Test on different screen sizes (compact mode)

## Dependencies Required

**New Imports**:
```typescript
import {useReplayContext} from 'sentry/components/replays/replayContext';
import formatDuration from 'sentry/utils/duration/formatDuration';
```

**No Breaking Changes**: This is purely additive functionality that gracefully degrades when data is not available.

## Expected Behavior

### Before Implementation
```
Settings > Playback Speed:
• 0.1x
• 0.25x
• 0.5x
✓ 1x
• 2x
• 4x
• 8x
• 16x
```

### After Implementation (with 20-minute replay)
```
Settings > Playback Speed:
• 0.1x (3:20:00)
• 0.25x (1:20:00)
• 0.5x (40:00)
✓ 1x (20:00)
• 2x (10:00)
• 4x (5:00)
• 8x (2:30)
• 16x (1:15)
```

### During Loading (no change)
```
Settings > Playback Speed:
• 0.1x
• 0.25x
• 0.5x
✓ 1x
• 2x
• 4x
• 8x
• 16x
```

## Files to Modify

1. **Primary**: `/static/app/components/replays/preferences/replayPreferenceDropdown.tsx`
   - Add duration calculation and display logic

2. **Tests** (if they exist):
   - Update existing tests for `replayPreferenceDropdown`
   - Add new tests for duration calculation

## Implementation Priority

**High Priority**: Core functionality (calculate and display duration)
**Medium Priority**: Edge case handling and formatting refinements
**Low Priority**: Styling enhancements and advanced accessibility features

This plan provides a clean, maintainable solution that enhances user experience without disrupting existing functionality.
