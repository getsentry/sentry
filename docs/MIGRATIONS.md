# Writing database migrations

## Quick start

1. Make your model change.
2. Generate: `sentry django makemigrations sentry --name <short_description>`
3. In the generated file (`src/sentry/migrations/`), change the base class from
   `migrations.Migration` to `CheckedMigration`.
4. Update the lockfile: `./bin/update-migration <number_or_name> sentry`
5. Apply locally: `sentry django migrate`

## CheckedMigration

All migrations must subclass `CheckedMigration`. It enforces zero-downtime safety
checks and rejects unsafe operations at import time.

```python
from sentry.new_migrations.migrations import CheckedMigration

class Migration(CheckedMigration):
    is_post_deployment = False
    dependencies = [("sentry", "NNNN_previous_migration")]
    operations = [...]
```

Set `checked = False` to disable safety checks. Requires `owners-migrations` approval.

## `is_post_deployment`

| Value             | Meaning                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `False` (default) | Runs automatically during deploy. For schema changes the new code needs on startup (new tables, non-nullable columns).       |
| `True`            | Skipped during deploy; must be triggered manually. For backfills, large index builds, or anything that could block a deploy. |

## `is_dangerous`

`is_dangerous = True` marks a migration that must never run automatically — even in
a pre-deployment slot. When `MIGRATION_SKIP_DANGEROUS=1` is set, the executor fakes
both `is_dangerous` and `is_post_deployment` migrations: Django records the row in
`django_migrations` but does not execute the SQL. Reserved for migrations that
require explicit operator invocation.

## Custom migration executor

Sentry replaces Django's `MigrationExecutor` with `SentryMigrationExecutor`
(`src/sentry/new_migrations/monkey/executor.py`), which adds two checks on every
`apply_migration` / `unapply_migration` call:

**DB routing** — `RunPython` and `SafeRunSQL` operations must declare which tables
they touch via `hints={"tables": [...]}` so the router selects the right database.
`FieldOperation`, `ModelOperation`, and `IndexOperation` are exempt. Missing hints
raise `MissingDatabaseRoutingInfo`.

```python
migrations.RunPython(
    my_backfill,
    migrations.RunPython.noop,
    hints={"tables": ["sentry_mymodel"]},
)
```

**BitField safety** — altering a `BitField` must not remove, reorder, or insert
flags between existing ones (each bit position is stored data). Raises `ValueError`
on violation. Set `skip_invalid_bitfield_change_check = True` on the migration class
to bypass for known-safe cases like squashes.

## Naming and lockfile

Migrations follow `NNNN_short_description.py` where `NNNN` is one higher than the
current maximum in `migrations_lockfile.txt`.

`migrations_lockfile.txt` records the latest migration per app to surface merge
conflicts early. Always update it when adding a migration:

```
sentry: 1097_sentry_option_seen
```

If you rebase onto a conflicting migration, renumber yours to be one higher and
re-run `./bin/update-migration`.

## Common operations

```python
# New table
migrations.CreateModel(
    name="MyModel",
    fields=[("id", sentry.db.models.fields.bounded.BoundedBigAutoField(primary_key=True)), ...],
    options={"db_table": "sentry_mymodel"},
)

# Add nullable column (safe, no lock)
migrations.AddField(model_name="mymodel", name="new_col", field=models.CharField(max_length=64, null=True))

# Add NOT NULL column — must supply db_default or default
migrations.AddField(model_name="mymodel", name="new_col", field=models.BooleanField(default=False, db_default=False))

# Delete a model (use SafeDeleteModel, not DeleteModel)
from sentry.new_migrations.monkey.models import SafeDeleteModel
from sentry.new_migrations.monkey.state import DeletionAction
SafeDeleteModel(name="OldModel", deletion_action=DeletionAction.DELETE)
```

## Data migrations

Write data migrations by hand — `makemigrations` won't know what data to move.
Mark them `is_post_deployment = True` unless the data must be clean before the new
code starts (rare).

```python
def backfill(apps, schema_editor):
    MyModel = apps.get_model("sentry", "MyModel")
    MyModel.objects.filter(col=None).update(col="default")

class Migration(CheckedMigration):
    is_post_deployment = True
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop, hints={"tables": ["sentry_mymodel"]})]
```
