# GroupHash Performance Optimization for RangeQuerySetWrapper

## Problem Analysis

The `delete_seer_grouping_records.py` task was experiencing severe performance issues when processing large numbers of group hashes (~237k records). The issue was caused by inefficient database queries in `RangeQuerySetWrapper`.

### Root Cause

`RangeQuerySetWrapper` adds `WHERE id > <current_id> ORDER BY id` to queries, but the original query was:

```sql
SELECT * FROM sentry_grouphash
WHERE project_id = X AND group_id IN (Y1, Y2, ...)
AND id > Z
ORDER BY id
LIMIT 100
```

Without proper indexing, this resulted in:

- ~2400 database requests for 237k records (237k / 100 batch_size)
- Expensive query execution due to missing composite indexes
- Potential query timeouts

## Solution

We've implemented two solution approaches:

### Option 1: Optimized Single Index (Recommended)

- **Migration**: `0974_add_grouphash_group_id_index.py`
- **Index**: `(group_id, id)`
- **Code Change**: Remove `project_id` filter, use only `group__id__in=group_ids`
- **Rationale**: Groups inherently belong to projects, so `group_id` filtering provides implicit project isolation

### Option 2: Comprehensive Index (Conservative)

- **Migration**: `0974_add_grouphash_comprehensive_index_alternative.py`
- **Index**: `(project_id, group_id, id)`
- **Code Change**: Keep existing filters
- **Rationale**: Maintains explicit project-level security filtering

## Files Modified

### Core Changes

- `src/sentry/tasks/delete_seer_grouping_records.py` - Optimized query filter
- `src/sentry/migrations/0974_add_grouphash_group_id_index.py` - Primary index migration
- `src/sentry/migrations/0974_add_grouphash_comprehensive_index_alternative.py` - Alternative migration

## Query Performance Testing

### Pre-deployment Testing

Before deploying, test the query performance using Redash or psql:

#### For Option 1 (Recommended):

```sql
-- Test the optimized query structure
EXPLAIN ANALYZE
SELECT * FROM sentry_grouphash
WHERE group_id IN (1, 2, 3, ...)
AND id > 12345
ORDER BY id
LIMIT 100;
```

#### For Option 2 (Conservative):

```sql
-- Test the comprehensive query structure
EXPLAIN ANALYZE
SELECT * FROM sentry_grouphash
WHERE project_id = 123
AND group_id IN (1, 2, 3, ...)
AND id > 12345
ORDER BY id
LIMIT 100;
```

### Expected Results

With the proper index, you should see:

- Index scan instead of sequential scan
- Execution time reduced from seconds/minutes to milliseconds
- No sorting operations (should use index ordering)
- Consistent performance regardless of result set size

### Testing Checklist

1. **Create Index**: Run the migration in staging first
2. **Verify Index Usage**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) [your_query_here];
   ```
3. **Performance Comparison**: Compare execution times before/after
4. **Load Testing**: Test with realistic group_id lists (10-100 groups)
5. **Memory Usage**: Monitor for any memory issues with large IN clauses

### Monitoring

After deployment, monitor:

- Task execution time for `delete_seer_grouping_records_by_hash`
- Database query performance metrics
- Any timeout errors in the logs

## Rollback Plan

If issues arise:

1. **Quick Fix**: Revert code changes to original filtering
2. **Index Removal**: Drop the new index if it causes issues:
   ```sql
   DROP INDEX CONCURRENTLY sentry_grouphash_group_id_idx;
   ```

## Additional Notes

- The migration is marked as `is_post_deployment = True` for safety
- Consider running ANALYZE after the index is created to update query planner statistics
- Monitor for any impact on other GroupHash queries
- The `IN` clause optimization may require testing with various group_id list sizes

## References

- Original conversation thread about the performance issue
- Django documentation on database indexing
- PostgreSQL documentation on composite indexes
