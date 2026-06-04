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
4. Apply the migration locally with `sentry django migrate <app_name>` — Sentry's migration framework runs its safety checks on apply, so this catches unsafe ops (missing `is_post_deployment`, unsafe column changes, etc.) before CI does.

When editing a generated migration (e.g. swapping `DeleteModel` for `SafeDeleteModel`), **leave the auto-generated `is_post_deployment` comment block in place**. It documents a non-obvious flag with concrete guidance for future migration authors — useful context, not fluff. Only remove a comment if it's stale or contradicts the code.

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

### Removing a Model (and eventually its table)

Two-phase process — the `historical_silo_assignments` entry must be added in phase 1.

**Phase 1 — Remove the model class (`MOVE_TO_PENDING`)**

1. Remove all code references
2. Replace `DeleteModel` with `SafeDeleteModel(..., deletion_action=DeletionAction.MOVE_TO_PENDING)`
3. Add the table to `historical_silo_assignments` in `src/sentry/db/router.py` (or `getsentry/db/router.py` for getsentry models). Pick the silo the model used — usually `SiloMode.CELL`.
4. Deploy

**Phase 2 — Drop the table (`DELETE`)**

After phase 1 has deployed, create a second migration with `SafeDeleteModel(..., deletion_action=DeletionAction.DELETE)`. Leave the historical entry in place — the table-drop migration relies on it to resolve the silo.

### Renaming Columns/Tables

Don't rename in Postgres. Use `db_column` or `Meta.db_table` to keep the old name.

## Resolving Merge Conflicts

If `migrations_lockfile.txt` conflicts:

```bash
bin/update-migration <migration_name>
```

This renames your migration, updates dependencies, and fixes the lockfile.
