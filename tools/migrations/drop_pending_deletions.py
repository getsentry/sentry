"""Drop tables and columns that migrations have moved to pending deletion.

The first step of a safe deletion (`DeletionAction.MOVE_TO_PENDING`) removes a
model or field from the migration state but leaves it in the database until a
later migration drops it. A schema built from that state never has them, so the
migrations-drift check drops them from the migrated database first.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

if TYPE_CHECKING:
    from django.db.backends.base.base import BaseDatabaseWrapper
    from django.db.models import Field, ManyToManyField, Model

    from sentry.new_migrations.monkey.state import SentryProjectState


def _auto_through_table(field: ManyToManyField[Any, Any]) -> str | None:
    through = field.remote_field.through
    assert through is not None
    return through._meta.db_table if through._meta.auto_created else None


def pending_deletion_sql(state: SentryProjectState, connection: BaseDatabaseWrapper) -> list[str]:
    """SQL for the `DeletionAction.DELETE` half of every pending deletion.

    Mirrors `SafeRemoveField` / `SafeDeleteModel`: a many-to-many field or model
    takes its auto-created through table with it, while explicit `through`
    models are only dropped when they are pending deletion themselves. There's
    no `CASCADE`, so anything else depending on these fails loudly instead of
    being dropped along with them.
    """
    from django.db import router
    from django.db.models import ManyToManyField

    def allow_migrate(model: type[Model]) -> bool:
        return model._meta.can_migrate(connection) and router.allow_migrate_model(
            connection.alias, model
        )

    q = connection.ops.quote_name
    columns: list[tuple[str, str]] = []
    through_tables: list[str | None] = []
    tables: list[str] = []

    # The state annotates these as `type[Field]`, but they're field instances.
    fields = cast("list[Field[Any, Any]]", list(state.pending_deletion_fields.values()))
    for field in fields:
        if not allow_migrate(field.model):
            continue
        if isinstance(field, ManyToManyField):
            through_tables.append(_auto_through_table(field))
        elif field.db_parameters(connection=connection)["type"] is not None:
            columns.append((field.model._meta.db_table, field.column))

    for model in state.pending_deletion_models.values():
        if not allow_migrate(model):
            continue
        through_tables += [_auto_through_table(f) for f in model._meta.local_many_to_many]
        tables.append(model._meta.db_table)

    # Through tables reference the tables they join, so they go first.
    return [f"ALTER TABLE {q(table)} DROP COLUMN {q(column)}" for table, column in columns] + [
        f"DROP TABLE {q(table)}" for table in [*through_tables, *tables] if table is not None
    ]


def main() -> int:
    from sentry.runner import configure

    configure()

    from django.conf import settings
    from django.db import connections
    from django.db.migrations.loader import MigrationLoader

    from sentry.new_migrations.monkey.state import SentryProjectState

    state = MigrationLoader(connections["default"]).project_state()
    assert isinstance(state, SentryProjectState), type(state)

    for alias, db in settings.DATABASES.items():
        if db.get("REPLICA_OF"):
            continue
        connection = connections[alias]
        with connection.cursor() as cursor:
            for statement in pending_deletion_sql(state, connection):
                print(f"{alias}: {statement}")
                cursor.execute(statement)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
