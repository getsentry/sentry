# Fix for Group.DoesNotExist in Trace Endpoint

## Issue: SENTRY-5F9W

### Problem
The `/api/0/organizations/{organization_id_or_slug}/trace/{trace_id}/` endpoint was raising `Group.DoesNotExist` exceptions when Snuba returned stale group IDs (groups that have been deleted or moved to different projects).

### Root Cause
1. Snuba uses `groupArray` to aggregate group IDs for occurrences
2. These aggregated group IDs can be stale (referring to deleted groups)
3. When serializing trace data, the code attempted to fetch these groups from the database
4. If a group didn't exist, `Group.objects.get()` raised `Group.DoesNotExist`

### Solution
Modified `/workspace/src/sentry/snuba/trace.py` to gracefully handle missing groups:

1. **Updated `_serialize_rpc_issue` function**:
   - Changed return type to `SerializedIssue | None`
   - Added try-except blocks around `Group.objects.get()` calls
   - Returns `None` when `Group.DoesNotExist` is raised
   - Logs a warning with contextual information when stale groups are encountered

2. **Updated `_serialize_rpc_event` function**:
   - Changed return type to include `None` as a possible return value
   - Filters out `None` values in list comprehensions for children, errors, and occurrences

3. **Updated `query_trace_data` function**:
   - Filters out `None` values when serializing root events

### Changes Made

#### Files Modified
- `src/sentry/snuba/trace.py`: Core fix implementation
- `tests/sentry/snuba/test_trace.py`: New unit tests (created)

#### Key Code Changes

**Before:**
```python
issue = Group.objects.get(id=issue_id, project__id=occurrence.project_id)
# Would raise Group.DoesNotExist for stale IDs
```

**After:**
```python
try:
    issue = Group.objects.get(id=issue_id, project__id=occurrence.project_id)
    group_cache[issue_id] = issue
except Group.DoesNotExist:
    logger.warning(
        "Group %s does not exist for project %s. Skipping occurrence in trace.",
        issue_id,
        occurrence.project_id,
        extra={...},
    )
    return None  # Gracefully skip stale groups
```

**Filtering None values:**
```python
errors = [
    serialized_error
    for error in event["errors"]
    if (serialized_error := _serialize_rpc_issue(error, group_cache)) is not None
]
```

### Testing

Created unit tests in `tests/sentry/snuba/test_trace.py`:
- `test_serialize_rpc_issue_with_missing_group_occurrence`: Verifies None is returned for missing occurrence groups
- `test_serialize_rpc_issue_with_missing_group_error`: Verifies None is returned for missing error groups
- `test_serialize_rpc_issue_with_existing_group_occurrence`: Verifies normal behavior still works
- `test_serialize_rpc_issue_uses_cache`: Verifies group caching works correctly

### Impact

**Before Fix:**
- Users would see 500 errors when viewing traces with stale group references
- Trace view would completely fail to load

**After Fix:**
- Stale groups are silently filtered out with a warning logged
- Trace view loads successfully with all valid data
- Only the stale groups are omitted from the response
- Better observability through warning logs

### Monitoring

Warning logs now include:
- `issue_id`: The stale group ID
- `project_id`: The project the occurrence belongs to
- `occurrence_id` or `event_id`: Additional context for debugging

This allows monitoring for data consistency issues between Snuba and the primary database.
