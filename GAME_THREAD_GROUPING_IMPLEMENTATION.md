# Game Thread Grouping for ANR Events

## Overview

This implementation addresses Linear issue ID-1321 and GitHub issue #103299 regarding improved grouping of ANR (Application Not Responding) errors in gaming applications.

## Problem Statement

Currently, ANR errors are grouped solely by the main UI thread's stacktrace. For gaming applications, this is problematic because:

1. The UI thread is often just blocked waiting on the game thread
2. The actual problem causing the ANR is typically in the game thread (e.g., `mainLoop()`)
3. All ANRs with similar UI thread blockages get grouped together, even though they have different root causes in the game thread

## Solution

The implementation adds server-side configuration to prioritize game threads over UI threads for ANR grouping in gaming applications.

### Key Components

#### 1. Thread Detection (`src/sentry/grouping/strategies/newstyle.py`)

**`_is_anr_event(event)`** - Identifies ANR events by:
- Checking if the exception mechanism type is "ANR"
- Checking if the exception type is "ApplicationNotResponding"

**`_is_game_thread(thread)`** - Identifies game threads by name patterns:
- Unity: `UnityMain`, `Unity Main Thread`
- Unreal Engine: `GameThread`, `FCocoaGameThread`, `runGameThread`
- Cocos2d: `Cocos2d`, `cocos2d-x`, `CocosThread`
- Generic: `mainLoop`, `GameLoop`, `game_thread`, `RenderThread`

#### 2. Modified Thread Selection Logic

The `threads:v1` strategy now:
1. Checks if game thread prioritization is enabled via `prioritize_game_thread_for_grouping` context option
2. For ANR events with the option enabled, attempts to use game thread first
3. Falls back to the original logic (crashed → current → all threads) if no game thread is found

#### 3. Configuration Option (`src/sentry/grouping/strategies/configurations.py`)

Added `prioritize_game_thread_for_grouping` to the base configuration context:
- Default: `False` (maintains backward compatibility)
- Can be enabled per-project for gaming customers
- Only affects ANR events, not other exception types

### Files Modified

1. **`src/sentry/grouping/strategies/newstyle.py`**
   - Added `_is_anr_event()` helper function
   - Added `_is_game_thread()` helper function
   - Modified `threads()` strategy to check for game threads first when enabled

2. **`src/sentry/grouping/strategies/configurations.py`**
   - Added `prioritize_game_thread_for_grouping` configuration option

### Files Created

1. **`tests/sentry/grouping/grouping_inputs/android-anr-game-thread.json`**
   - Test fixture with ANR event containing both UI thread and Unity game thread
   - Demonstrates realistic gaming ANR scenario

2. **`tests/sentry/grouping/test_game_thread_grouping.py`**
   - Unit tests for game thread detection
   - Unit tests for ANR event detection
   - Integration tests for grouping behavior with/without the option enabled

## Usage

### For Gaming Customers

To enable game thread grouping for a project:

```python
# This would be configured via project options or a feature flag
project.update_option("sentry:grouping_config", "newstyle:2026-01-20")
# Then enable the game thread prioritization context option
# (Implementation of per-project context option configuration would be needed)
```

### Expected Behavior

**Without game thread prioritization (default):**
- ANRs group by UI thread stacktrace
- Multiple ANRs with similar UI blocking patterns group together
- Different game thread issues are not distinguished

**With game thread prioritization (enabled):**
- ANRs group by game thread stacktrace (if present)
- ANRs with different game thread problems are separated into different groups
- More actionable grouping for gaming applications

## Benefits

1. **Better Issue Triage**: Gaming teams can see the actual problem in the game loop
2. **Improved Grouping Granularity**: ANRs are subdivided by real root causes
3. **Backward Compatible**: Disabled by default, opt-in for gaming customers
4. **Flexible**: Detects multiple game engine thread patterns (Unity, Unreal, Cocos2d, etc.)

## Future Enhancements

Potential improvements for future iterations:

1. **Project-level configuration UI**: Add UI in Sentry to enable/disable this option per-project
2. **Custom thread patterns**: Allow projects to define their own game thread name patterns
3. **Automatic detection**: Use heuristics to detect gaming apps and suggest enabling this feature
4. **Enhanced thread analysis**: Consider multiple game threads or worker threads
5. **Performance metrics**: Track how this affects grouping quality and cardinality

## Testing

Run the test suite:

```bash
pytest tests/sentry/grouping/test_game_thread_grouping.py -v
```

Tests cover:
- Game thread name pattern detection (Unity, Unreal, Cocos2d, generic patterns)
- ANR event identification
- Grouping behavior with option enabled/disabled
- Non-ANR events are unaffected

## References

- Linear Issue: ID-1321
- GitHub Issue: https://github.com/getsentry/sentry/issues/103299
- Related Discussion: Server-side heuristics for ANR root cause analysis
