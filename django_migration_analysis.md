# Django Migrations That Never Run Successfully: Remove vs. Return Nothing

## Summary

When Django migrations never run successfully, you have two main options:
1. **Make them return nothing** (no-op migrations)
2. **Remove them entirely** from the migration files

The choice depends on several factors, but **making migrations return nothing is generally the safer approach** for most production scenarios.

## Key Considerations

### 1. Migration History and Consistency

**Why returning nothing is often better:**
- Preserves the migration history and sequence numbers
- Maintains consistency across different environments (dev, staging, prod)
- Avoids creating "holes" in the migration sequence that can cause confusion
- Prevents dependency issues with other migrations that might reference the problematic migration

**When removal might be appropriate:**
- The migration was never applied in any environment
- It's a recent migration that hasn't been deployed to production
- No other migrations depend on it
- All team members can coordinate the removal

### 2. Production Safety

**No-op migrations are safer because:**
- They don't disrupt existing deployment pipelines
- Database migration tables (`django_migrations`) remain consistent
- No risk of migration dependency errors
- Rollback procedures remain intact

**Removing migrations can be risky:**
- May cause `InconsistentMigrationHistory` errors
- Can break deployment scripts that expect certain migration files
- Requires careful coordination across all environments
- May cause issues for developers who already have the migration applied locally

### 3. Common Patterns for No-Op Migrations

Instead of removing problematic migrations, convert them to no-ops:

```python
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('your_app', '0001_initial'),
    ]

    operations = [
        # Instead of problematic operations, use no-op
        migrations.RunPython(migrations.RunPython.noop, migrations.RunPython.noop),
    ]
```

Or for schema migrations:
```python
class Migration(migrations.Migration):
    dependencies = [
        ('your_app', '0001_initial'),
    ]

    operations = [
        # Empty operations list = no-op
    ]
```

### 4. When to Consider Removal

**Remove migrations only when:**
- The migration has never been applied anywhere (including local dev environments)
- It's part of a feature branch that was never merged
- You can guarantee all team members will pull the updated code simultaneously
- The migration has no dependencies from other migrations
- It's a recent migration (last few commits) and deployment can be coordinated

### 5. Large-Scale Database Considerations

For large production databases (like the 3TB+ examples mentioned in Django forums):
- Problematic migrations are often due to table size constraints
- Converting to no-ops allows for manual database schema changes
- External tools (like Percona's pt-online-schema-change) can be used instead
- Migration history remains intact for audit purposes

## Best Practices

### 1. For Active Production Systems
- **Always prefer no-op migrations** over removal
- Document why the migration was made a no-op
- Include comments explaining the alternative approach used
- Keep the migration file for historical reference

### 2. For Development/Feature Branches
- Remove migrations that were never applied
- Squash and recreate if needed
- Ensure all team members coordinate the change

### 3. For Irreversible Operations
- Especially important to use no-ops rather than removal
- Irreversible migrations that fail can't be rolled back anyway
- No-op preserves the migration sequence for future reference

## Specific to the Sentry PR Context

For the Sentry codebase mentioned in the question:
- Given Sentry's scale and production complexity, **no-op migrations are likely the safer choice**
- Large-scale applications often have complex deployment pipelines that expect migration continuity
- The risk of breaking production deployments outweighs the minor inconvenience of no-op migrations
- No-ops allow for manual database operations while maintaining migration history

## Conclusion

While removing migrations entirely might seem cleaner, **making them return nothing (no-op) is generally the safer and more maintainable approach** for production systems. This preserves migration history, maintains system consistency, and reduces the risk of deployment issues.

Only remove migrations when you can guarantee they've never been applied anywhere and you can coordinate the change across all team members and environments.

## Additional Resources

- Django documentation on [Reversing migrations](https://docs.djangoproject.com/en/stable/topics/migrations/#reversing-migrations)
- Best practices for [Migration dependencies](https://docs.djangoproject.com/en/stable/topics/migrations/#dependencies)
- Handling [Irreversible migrations](https://docs.djangoproject.com/en/stable/topics/migrations/#reversing-migrations)
