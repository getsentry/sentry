# JavaScript/React Native Stacktrace Symbolication Analysis

## Overview
This document identifies the core code in Sentry that iterates over stacktrace lines and performs token lookup/symbolication for JavaScript and React Native source maps.

## Key Components

### 1. Main Processing Function
**File**: `src/sentry/lang/javascript/processing.py`
**Function**: `process_js_stacktraces(symbolicator: Symbolicator, data: Any)`

This is the primary function that handles JavaScript stacktrace symbolication. It:
- Extracts stacktrace information from event data
- Filters frames that need symbolication using `_handles_frame()`
- Sends stacktraces to the external Symbolicator service for token lookup
- Merges symbolicated results back into the original frames

### 2. Core Iteration Logic
**Location**: `src/sentry/lang/javascript/processing.py:281-295`

The main loop that iterates over stacktrace frames:

```python
for sinfo_frame in sinfo.stacktrace["frames"]:
    if not _handles_frame(sinfo_frame, data):
        new_raw_frames.append(sinfo_frame)
        new_frames.append(_normalize_nonhandled_frame(dict(sinfo_frame), data))
        continue

    raw_frame = raw_stacktrace["frames"][processed_frame_idx]
    complete_frame = complete_stacktrace["frames"][processed_frame_idx]
    processed_frame_idx += 1

    merged_context_frame = _merge_frame_context(sinfo_frame, raw_frame)
    new_raw_frames.append(merged_context_frame)

    merged_frame = _merge_frame(sinfo_frame, complete_frame)
    # ... additional processing
    new_frames.append(merged_frame)
```

### 3. Token Lookup Service
**File**: `src/sentry/lang/native/symbolicator.py`
**Method**: `Symbolicator.process_js()`

This method performs the actual token lookup by:
- Sending JavaScript stacktraces and source map modules to the external Symbolicator service
- Including release and distribution information for proper source map resolution
- Returning symbolicated frame data with resolved function names, file paths, and line/column numbers

### 4. Frame Filtering Logic
**Function**: `_handles_frame(frame, data)` in `src/sentry/lang/javascript/processing.py:158-178`

Determines which frames should be symbolicated:
- Must be a JavaScript platform (`javascript`, `node`, `react-native`)
- Must have an `abs_path` and `lineno`
- Excludes "native" frames and built-in Node.js modules
- Filters out frames that don't match the expected pattern

### 5. Integration Points

**Task System**: `src/sentry/tasks/symbolication.py`
- `process_js_stacktraces` is called from the symbolication task system
- Specifically handled by `symbolicate_js_event` task

**Plugin Integration**: `src/sentry/lang/javascript/plugin.py`
- JavaScript plugin provides event preprocessing
- Handles module generation and exception rewriting before symbolication

## Key Data Flow

1. **Event Processing**: JavaScript events enter the symbolication pipeline
2. **Stacktrace Extraction**: `find_stacktraces_in_data()` extracts all stacktraces from the event
3. **Frame Filtering**: Each frame is checked with `_handles_frame()` to determine if it needs symbolication
4. **Normalization**: Frames are normalized with `_normalize_frame()` to extract only relevant fields
5. **External Service Call**: `symbolicator.process_js()` sends stacktraces to the Symbolicator service
6. **Token Lookup**: The external service performs source map resolution and token lookup
7. **Result Merging**: `_merge_frame()` and `_merge_frame_context()` merge symbolicated data back into original frames
8. **In-App Detection**: `is_in_app()` determines if frames are part of application code vs. third-party libraries

## Relevant Files
- `src/sentry/lang/javascript/processing.py` - Main symbolication logic
- `src/sentry/lang/native/symbolicator.py` - External service interface
- `src/sentry/tasks/symbolication.py` - Task orchestration
- `src/sentry/stacktraces/processing.py` - General stacktrace processing framework
- `src/sentry/lang/javascript/plugin.py` - JavaScript-specific preprocessing

## Pre-symbolicated Frame Handling
Related to the Slack context about Amazon's Kepler team: The current code doesn't have special handling for pre-symbolicated frames with extra colons (e.g., `file.js::123::4`). This would need to be added to the frame filtering or processing logic to skip already-symbolicated lines during the unminification process.
