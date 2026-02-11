---
name: generate-migration
description: Generate Django database migrations for Sentry. Use when creating migrations, adding/removing columns or tables, adding indexes, or resolving migration conflicts.
---

# Generate Django Database Migrations

## Commands

Generate migrations automatically based on model changes:

```bash
sentry django makemigrations
```

For a specific app:

```bash
sentry django makemigrations <app_name>
```

Generate an empty migration (for data migrations or custom work):

```bash
sentry django makemigrations <app_name> --empty
```

## After Generating

1. If you added a new model, ensure it's imported in the app's `__init__.py`
2. Review the generated migration for correctness
3. Run `sentry django sqlmigrate <app_name> <migration_name>` to verify the SQL

## Guidelines

### Adding Columns

- Use `db_default=<value>` instead of `default=<value>` for columns with defaults
- Nullable columns: use `null=True`
- Not null columns: must have `db_default` set

### Adding Indexes

For large tables, set `is_post_deployment = True` on the migration as index creation may exceed the 5s timeout.

### Deleting Columns

1. Make column nullable (`null=True`) if not already
2. Remove all code references
3. Replace `RemoveField` with `SafeRemoveField(..., deletion_action=DeletionAction.MOVE_TO_PENDING)`
4. Deploy, then create second migration with `SafeRemoveField(..., deletion_action=DeletionAction.DELETE)`

### Deleting Tables

1. Remove all code references
2. Replace `DeleteModel` with `SafeDeleteModel(..., deletion_action=DeletionAction.MOVE_TO_PENDING)`
3. Deploy, then create second migration with `SafeDeleteModel(..., deletion_action=DeletionAction.DELETE)`

### Renaming Columns/Tables

Don't rename in Postgres. Use `db_column` or `Meta.db_table` to keep the old name.

## Resolving Merge Conflicts

If `migrations_lockfile.txt` conflicts:

```bash
bin/update-migration <migration_name>
```

This renames your migration, updates dependencies, and fixes the lockfile.
