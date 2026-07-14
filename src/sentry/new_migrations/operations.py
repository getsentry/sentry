from typing import LiteralString

from sentry.new_migrations.monkey.special import SafeRunSQL


def to_jsonb(table: LiteralString, column: LiteralString) -> SafeRunSQL:
    """
    Returns a SafeRunSQL operation that converts a column from text to jsonb in-place.
    Use inside SeparateDatabaseAndState.database_operations.
    """
    return SafeRunSQL(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE jsonb USING {column}::jsonb;",
        reverse_sql=f"ALTER TABLE {table} ALTER COLUMN {column} TYPE text;",
        hints={"tables": [table]},
    )
