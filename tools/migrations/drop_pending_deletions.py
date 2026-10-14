"""Drop tables and columns that migrations have moved to pending deletion.

The first step of a safe deletion (`DeletionAction.MOVE_TO_PENDING`) removes a
model or field from the migration state but leaves it in the database until a
later migration drops it. A schema built from that state never has them, so the
migrations-drift check drops them from the migrated database first.
"""

from __future__ import annotations

from sentry.runner import configure

configure()

from django.conf import settings  # noqa: E402
from django.db import connections  # noqa: E402
from django.db.migrations.loader import MigrationLoader  # noqa: E402

from sentry.new_migrations.monkey.state import SentryProjectState  # noqa: E402


def main() -> int:
    state = MigrationLoader(connections["default"]).project_state()
    assert isinstance(state, SentryProjectState), type(state)

    tables = [model._meta.db_table for model in state.pending_deletion_models.values()]
    columns = [
        (field.model._meta.db_table, field.column)
        for field in state.pending_deletion_fields.values()
        if field.column is not None
    ]

    for alias, db in settings.DATABASES.items():
        if db.get("REPLICA_OF"):
            continue
        connection = connections[alias]
        q = connection.ops.quote_name
        statements = [f"DROP TABLE IF EXISTS {q(table)} CASCADE" for table in tables]
        statements += [
            f"ALTER TABLE IF EXISTS {q(table)} DROP COLUMN IF EXISTS {q(column)} CASCADE"
            for table, column in columns
        ]
        with connection.cursor() as cursor:
            for statement in statements:
                print(f"{alias}: {statement}")
                cursor.execute(statement)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
