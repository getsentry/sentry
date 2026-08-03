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

    A plain AlterField is rejected: the safety framework does not allow integer -> bigint.
    The ALTER rewrites the table under an ACCESS EXCLUSIVE lock, so it only suits tables
    small enough to rewrite inside the lock and statement timeouts; bigger ones need a
    shadow-column cutover. A serial column's sequence keeps its integer type across the
    ALTER and would still overflow at 2^31, so it is widened separately.
    """
    return SafeRunSQL(
        [
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE bigint USING {column}::bigint;",
            f"""
            DO $$
            DECLARE seq text := pg_get_serial_sequence('{table}', '{column}');
            BEGIN
                IF seq IS NOT NULL THEN
                    EXECUTE 'ALTER SEQUENCE ' || seq || ' AS bigint';
                END IF;
            END $$;
            """,
        ],
        reverse_sql=[
            f"""
            DO $$
            DECLARE seq text := pg_get_serial_sequence('{table}', '{column}');
            BEGIN
                IF seq IS NOT NULL THEN
                    EXECUTE 'ALTER SEQUENCE ' || seq || ' AS integer';
                END IF;
            END $$;
            """,
            f"ALTER TABLE {table} ALTER COLUMN {column} TYPE integer USING {column}::integer;",
        ],
        hints={"tables": [table]},
    )
