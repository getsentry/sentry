# Fix: Exclude groups with DELETION_IN_PROGRESS status from cleanup deletion

## Problem

The `BulkDeleteQuery` class used by the cleanup command (`sentry cleanup --days=N`) was not respecting group status when deleting old groups. This caused a bug where groups already being deleted (status = `GroupStatus.DELETION_IN_PROGRESS` or `GroupStatus.PENDING_DELETION`) could be selected again for cleanup deletion, leading to:

- **Race conditions** between manual deletion processes and cleanup processes
- **Potential data corruption** when the same group is processed for deletion by multiple systems simultaneously
- **Inconsistent behavior** compared to other parts of the system that properly exclude groups with deletion statuses

## Root Cause

The `BulkDeleteQuery` class in `src/sentry/db/deletion.py` only considered:
1. Age of the group (based on `last_seen` field)  
2. Project/organization filters
3. **Completely ignored the group's status field**

This was inconsistent with other parts of the codebase:
- Manual group deletion in `src/sentry/api/helpers/group_index/delete.py` properly excludes these statuses
- Seer grouping utilities in `src/sentry/tasks/embeddings_grouping/utils.py` properly exclude these statuses

## Solution

Modified the `BulkDeleteQuery` class to:
1. **Detect when processing Group models** via `_is_group_model()` helper method
2. **Add status filtering** for groups to exclude `GroupStatus.PENDING_DELETION` and `GroupStatus.DELETION_IN_PROGRESS`
3. **Apply filtering in both methods**:
   - `execute()` method (direct SQL deletion)
   - `iterator()` method (returns chunks for processing)
4. **Only apply to Group models** - other models with status fields are unaffected

## Code Changes

### `src/sentry/db/deletion.py`
- Added `_is_group_model()` method to detect Group model processing
- Added `_get_group_status_exclusions()` method to get excluded statuses
- Modified `execute()` method to add status filtering for groups
- Modified `iterator()` method to add status filtering for groups

### `tests/sentry/db/test_deletion.py`
- Added `test_excludes_groups_with_deletion_in_progress_status()` - tests that groups with deletion statuses are excluded from cleanup
- Added `test_excludes_groups_with_deletion_status_in_iterator()` - tests that iterator also excludes these groups
- Added `test_status_exclusion_only_applies_to_group_model()` - ensures other models are unaffected

## Testing

Three comprehensive test cases verify:
1. ✅ Groups with `DELETION_IN_PROGRESS` status are **NOT deleted** by cleanup
2. ✅ Groups with `PENDING_DELETION` status are **NOT deleted** by cleanup  
3. ✅ Normal groups (older than cutoff) **ARE deleted** by cleanup
4. ✅ Iterator method properly excludes groups with deletion statuses
5. ✅ Status filtering only applies to Group models, not other models

## Impact

- **Fixes race conditions** during group deletion operations
- **Prevents data corruption** from concurrent deletion processes
- **Maintains consistency** with other parts of the system
- **Zero impact** on non-Group models using BulkDeleteQuery

## Before/After

**Before:**
```sql
-- Cleanup command would select ALL old groups regardless of status
SELECT id FROM sentry_group 
WHERE last_seen < '2023-10-01'::timestamptz
```

**After:**
```sql  
-- Cleanup command now excludes groups being deleted
SELECT id FROM sentry_group 
WHERE last_seen < '2023-10-01'::timestamptz
AND status NOT IN (3, 4)  -- PENDING_DELETION, DELETION_IN_PROGRESS
```

This fix ensures that groups older than 90 days (or any age threshold) with `DELETION_IN_PROGRESS` status are properly excluded from cleanup deletion, resolving the reported bug.