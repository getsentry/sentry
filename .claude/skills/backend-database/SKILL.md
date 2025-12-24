---
name: backend-database
description: Guidelines that should be followed when working with Django models.
---

## Database Guidelines

1. NEVER join across silos
2. Use `outbox` for cross-silo updates
3. Migrations must be backwards compatible
4. Add indexes for queries on 1M+ row tables
5. Use `db_index=True` or `db_index_together`

## Performance Considerations

1. Use database indexing appropriately
2. Implement pagination for list endpoints
3. Cache expensive computations with Redis
4. Use Celery for background tasks
5. Optimize queries with `select_related` and `prefetch_related`

### Composite Index Strategy: Match Your Query Patterns

**Critical Rule**: When writing a query that filters on multiple columns simultaneously, you MUST verify that a composite index exists covering those columns in the filter order.

**How to Identify When You Need a Composite Index:**

1. **Look for Multi-Column Filters**: Any query using multiple columns in `.filter()` or `WHERE` clause
2. **Check Index Coverage**: Verify the model's `Meta.indexes` includes those columns
3. **Consider Query Order**: Index column order should match the most selective filters first

**Common Patterns Requiring Composite Indexes:**

```python
# NEEDS COMPOSITE INDEX: Filtering on foreign_key_id AND id
Model.objects.filter(
    foreign_key_id__in=ids,  # First column
    id__gt=last_id           # Second column
)[:batch_size]
# Required: Index(fields=["foreign_key", "id"])

# NEEDS COMPOSITE INDEX: Status + timestamp range queries
Model.objects.filter(
    status="open",           # First column
    created_at__gte=start    # Second column
)
# Required: Index(fields=["status", "created_at"])

# NEEDS COMPOSITE INDEX: Org + project + type lookups
Model.objects.filter(
    organization_id=org_id,  # First column
    project_id=proj_id,      # Second column
    type=event_type          # Third column
)
# Required: Index(fields=["organization", "project", "type"])
```

**How to Check if Index Exists:**

1. Read the model file: Check the `Meta` class for `indexes = [...]`
2. Single foreign key gets auto-index, but **NOT** when combined with other filters
3. If you filter on FK + another column, you need explicit composite index

**Red Flags to Watch For:**

- Query uses `column1__in=[...]` AND `column2__gt/lt/gte/lte`
- Query filters on FK relationship PLUS primary key or timestamp
- Pagination queries combining filters with cursor-based `id__gt`
- Large IN clauses combined with range filters

**When in Doubt:**

1. Check production query performance in Sentry issues (slow query alerts)
2. Run `EXPLAIN ANALYZE` on similar queries against production-sized data
3. Add the composite index if table has 1M+ rows and query runs in loops/batches

### Silo Mode

- **Control Silo**: User auth, billing, organization management
- **Region Silo**: Project data, events, issues
- Check model's silo in `src/sentry/models/outbox.py`
- Use `@region_silo_endpoint` or `@control_silo_endpoint`
