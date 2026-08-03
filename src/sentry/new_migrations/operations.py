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


def to_bigint(table: LiteralString, column: LiteralString) -> SafeRunSQL:
    """
    Returns a SafeRunSQL operation that widens an integer column to bigint in-place.
    Use inside SeparateDatabaseAndState.database_operations.

    A plain AlterField cannot do this: integer -> bigint is not on the safety framework's
    allowlist of immediate type casts, and it trips a second check when the column is
    indexed. The ALTER rewrites the table under an ACCESS EXCLUSIVE lock, so this is only
    appropriate for tables small enough to rewrite inside the lock and statement timeouts;
    larger tables need a shadow-column cutover.

    For an identity column the backing sequence is widened by the same ALTER, so no
    separate ALTER SEQUENCE is needed.
    """
    return SafeRunSQL(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE bigint USING {column}::bigint;",
        reverse_sql=f"ALTER TABLE {table} ALTER COLUMN {column} TYPE integer USING {column}::integer;",
        hints={"tables": [table]},
    )
