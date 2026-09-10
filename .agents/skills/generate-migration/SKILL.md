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

### Don't test the ORM

Don't write tests that only exercise Django's ORM. Standard operations — create/update/delete, cascading deletes, unique-constraint enforcement — are provided by Django and Postgres and are assumed to work. Test _your_ logic (business rules, signal receivers, custom managers/validation), not the framework's.

### Do test data migrations and backfills

The exception to the above: a migration that **backfills or transforms data** is your logic, and it must have a test. Use the `TestMigrations` base class from `sentry.testutils.cases`; tests live in `tests/sentry/migrations/`.

Set `app`, `migrate_from` (the migration just before yours), and `migrate_to` (yours). Seed pre-migration rows in `setup_before_migration(self, apps)` using the **historical** model registry (`apps.get_model("sentry", "MyModel")`) — not a direct `from sentry.models...` import, since the current model may not match the schema at `migrate_from`. Then assert the post-migration state.

**Write exactly one `test_*` method.** `setUp` runs the full migrate-down → seed → migrate-up cycle on _every_ test method, so each extra method pays for another round trip with no added coverage. Cover multiple cases by seeding all of them in `setup_before_migration` and asserting each in the single test body.

```python
from sentry.testutils.cases import TestMigrations


class BackfillFooTest(TestMigrations):
    app = "sentry"
    migrate_from = "0123_before"
    migrate_to = "0124_backfill_foo"

    def setup_before_migration(self, apps):
        Foo = apps.get_model("sentry", "Foo")
        self.empty = Foo.objects.create(value=None)
        self.already_set = Foo.objects.create(value="kept")

    def test_backfill(self):
        self.empty.refresh_from_db()
        self.already_set.refresh_from_db()
        assert self.empty.value == "expected"
        assert self.already_set.value == "kept"
```

**`app` and `connection`**: `app` is the Django app label whose migration you're testing — `"sentry"` by default, but set it to e.g. `"workflow_engine"` when the migration lives in that app's `migrations/` directory. `connection` is the database alias, `"default"` by default; set it to whichever connection the model's table actually lives on. Both must match where the migration and its tables actually live, or the migrate up/down will run against the wrong database.

Run these tests locally with the `--migrations` and `--reuse-db` flags. On the first run, it will be necessary to use `--create-db` along with `--reuse-db` to get the database in a good state.

## Guidelines

### Adding Columns

- Use `db_default=<value>` instead of `default=<value>` for columns with defaults
- Nullable columns: use `null=True`
- Not null columns: must have `db_default` set

### Adding Indexes

For large tables, set `is_post_deployment = True` on the migration as index creation may exceed the 5s timeout.

### Deleting Columns

Deleting takes two migrations. Write both up front, but they must be **two separate PRs**, with phase 2 stacked on top off phase 1 so its migration depends on it. Say clearly that **phase 2 can't merge until phase 1 has deployed** — merging them together drops the column while old code is still running.

**Phase 1 — `MOVE_TO_PENDING`**

Run `makemigrations` twice, in this order. Once the field is off the model Django can't generate the `AlterField` anymore, so doing it the other way around means silently shipping without it.

1. With the field **still on the model**, edit it in place: `db_constraint=False` if it's an FK, `null=True` if it's not nullable and has no `db_default`. Run `makemigrations` to get the `AlterField`.
2. Remove the field and every code reference to it, then `makemigrations` again. Replace the generated `RemoveField` with `SafeRemoveField(..., deletion_action=DeletionAction.MOVE_TO_PENDING)` — this drops the Django state, not the column.
3. Hand-merge both into one migration. Example:

```python
operations = [
    migrations.AlterField(
        model_name="testmodel",
        name="project",
        field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
            db_constraint=False,
            null=True,
            on_delete=django.db.models.deletion.CASCADE,
            to="sentry.project",
        ),
    ),
    SafeRemoveField(
        model_name="testmodel", name="project", deletion_action=DeletionAction.MOVE_TO_PENDING
    ),
]
```

**Phase 2 — `DELETE`** (second PR, merges after phase 1 deploys)

`makemigrations <app> --empty`, then the same `SafeRemoveField` with `deletion_action=DeletionAction.DELETE`. Nothing else in the PR.

### Removing a Model (and eventually its table)

Dropping a table takes two migrations. Write both up front, but they must be **two separate PRs**, with phase 2 stacked on top off phase 1 so its migration depends on it. Say clearly that **phase 2 can't merge until phase 1 has deployed** — merging them together drops the table while old code is still running.

**First, check for inbound FKs.** If other tables have foreign keys pointing at this one, those columns need their own "Deleting Columns" pass, and both of its phases must be deployed before this model's phase 1 can merge.

**Phase 1 — `MOVE_TO_PENDING`**

Run `makemigrations` twice, in this order. Once the model is gone Django can't generate the `AlterField`s anymore, so doing it the other way around means silently shipping without them.

1. On each of the model's **outbound** FK fields, add `db_constraint=False` (`null=True` instead for a `HybridCloudForeignKey`), then `makemigrations` for the `AlterField` operations.
2. Remove the model and all code references, `makemigrations` again, and replace the generated `DeleteModel` with `SafeDeleteModel(..., deletion_action=DeletionAction.MOVE_TO_PENDING)`.
3. Merge both into one migration, `AlterField`s first.
4. Add the table to `historical_silo_assignments` in `src/sentry/db/router.py` (or `getsentry/db/router.py`). Pick the silo the model used — usually `SiloMode.CELL`.

Dropping the constraints is not optional. The tables survive until phase 2, but Django no longer knows about them, so it can't cascade into them — a delete on a surviving parent table will fail on the leftover constraint. When removing **several** models at once, also drop the constraints _between_ the pending-deletion tables, so phase 2's `DROP TABLE` order doesn't matter.

**Phase 2 — `DELETE`** (second PR, merges after phase 1 deploys)

`makemigrations <app> --empty`, then the same `SafeDeleteModel` with `deletion_action=DeletionAction.DELETE`. Leave the `historical_silo_assignments` entry in place — the table-drop migration needs it to resolve the silo.

### Renaming Columns/Tables

Don't rename in Postgres. Use `db_column` or `Meta.db_table` to keep the old name.

## Resolving Merge Conflicts

If `migrations_lockfile.txt` conflicts:

```bash
bin/update-migration <migration_name>
```

This renames your migration, updates dependencies, and fixes the lockfile.
