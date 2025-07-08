# Chunking Changes for Seer Grouping Records Deletion

## Summary
Modified the `call_delete_seer_grouping_records_by_hash` function in `src/sentry/tasks/delete_seer_grouping_records.py` to chunk large numbers of group hashes into separate tasks with a maximum of 1000 hashes per task.

## Changes Made

### 1. Added import for chunking utility
```python
from sentry.utils.iterators import chunked
```

### 2. Modified task creation logic
**Before:**
```python
if group_hashes:
    delete_seer_grouping_records_by_hash.apply_async(args=[project.id, group_hashes, 0])
```

**After:**
```python
if group_hashes:
    # Chunk the group_hashes into batches of 1000 and create separate tasks
    for hash_chunk in chunked(group_hashes, 1000):
        delete_seer_grouping_records_by_hash.apply_async(args=[project.id, hash_chunk, 0])
```

### 3. Added test case
Added `test_call_delete_seer_grouping_records_by_hash_chunked` to verify that:
- Large numbers of hashes (2500) are correctly chunked into multiple tasks
- Each task receives a maximum of 1000 hashes
- The correct number of tasks are created (3 tasks for 2500 hashes)
- Each task receives the correct parameters (project_id, hash_chunk, 0)

## Benefits
- **Memory efficiency**: Prevents creation of tasks with excessively large hash lists
- **Task distribution**: Enables better distribution of work across multiple workers
- **Scalability**: Handles large group deletions more efficiently
- **Maintainability**: Uses existing chunking utilities for consistency

## Implementation Details
- **Chunk size**: 1000 hashes per task (configurable if needed)
- **Backward compatibility**: Existing behavior is preserved for small numbers of hashes
- **Error handling**: Maintains existing error handling and killswitch logic
- **Logging**: Existing logging continues to work, showing all hashes in the log message

## Testing
The new test case `test_call_delete_seer_grouping_records_by_hash_chunked` verifies:
1. Correct number of tasks created based on total hashes
2. Each task receives the correct chunk size
3. Remainder chunks are handled correctly
4. All tasks receive the correct project_id and starting index (0)

The existing test `test_call_delete_seer_grouping_records_by_hash_simple` continues to work for small numbers of hashes (< 1000), but now expects multiple calls to `apply_async` when the chunk size is exceeded.
