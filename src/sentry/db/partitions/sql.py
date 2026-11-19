"""
Every SQL statement used for table partitioning lives in this module.

Production runs Postgres 14 while local development and CI run Postgres 18, so all
statements here must stay compatible with Postgres 14 until the production upgrade
is finished. Features we rely on, all available in Postgres 14:

- ``PARTITION BY RANGE`` / ``PARTITION BY HASH``
- ``ALTER TABLE ... ATTACH PARTITION`` (takes SHARE UPDATE EXCLUSIVE on the parent)
- ``ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY`` / ``FINALIZE``
- ``CREATE INDEX ... ON ONLY`` and ``ALTER INDEX ... ATTACH PARTITION``
- ``CREATE TABLE ... (LIKE ... INCLUDING ...)``
- ``pg_partitioned_table``, ``pg_inherits`` (including ``inhdetachpending``),
  ``pg_get_expr(relpartbound, oid)``

Do not use anything that needs Postgres 15 or later, for example: ``MERGE``,
``NULLS NOT DISTINCT``, ``NOT VALID`` on NOT NULL constraints, ``NOT ENFORCED``,
or exclusion constraints on partitioned tables. ``POSTGRES_14_INCOMPATIBLE`` lists
patterns that tests check against every template here and against generated DDL.

Limitations the callers work around:

- ``CREATE INDEX CONCURRENTLY`` is not supported on a partitioned table, in any
  Postgres version up to at least 18, so indexes are created ``ON ONLY`` the parent,
  built concurrently on each partition and then attached.
- Postgres 14 can't add a ``NOT VALID`` foreign key to a partitioned table (Postgres
  18 can), so foreign keys are only created together with the table, while it is
  empty.

Identifiers are formatted in with ``str.format`` after quoting. Templates that are
handed to Django's schema editor use Django's ``%(name)s`` style instead.
"""

from __future__ import annotations

from datetime import UTC, datetime

POSTGRES_14_INCOMPATIBLE: tuple[str, ...] = (
    r"\bMERGE\s+INTO\b",
    r"\bNULLS\s+(NOT\s+)?DISTINCT\b",
    r"\bNOT\s+ENFORCED\b",
    # Named NOT NULL constraints, including `NOT VALID` ones (Postgres 18).
    r"\bCONSTRAINT\s+\S+\s+NOT\s+NULL\b",
    r"\bSPLIT\s+PARTITION\b",
    r"\bMERGE\s+PARTITIONS\b",
    r"\bEXCLUDE\s+USING\b",
)

# Appended to Django's CREATE TABLE statement.
PARTITION_BY = " PARTITION BY {method} ({columns})"
PRIMARY_KEY_CONSTRAINT = "CONSTRAINT {name} PRIMARY KEY ({columns})"

# Only used right after the parent table is created, while it is empty. Creating a
# partition this way takes an ACCESS EXCLUSIVE lock on the parent.
CREATE_HASH_PARTITION = (
    "CREATE TABLE {partition} PARTITION OF {table} "
    "FOR VALUES WITH (MODULUS {modulus}, REMAINDER {remainder})"
)
CREATE_RANGE_PARTITION = (
    "CREATE TABLE {partition} PARTITION OF {table} FOR VALUES FROM ({start}) TO ({end})"
)

# Used to add partitions to a live table. The partition is created as a standalone
# table and then attached, which only needs a SHARE UPDATE EXCLUSIVE lock on the
# parent. The CHECK constraint matching the bounds lets ATTACH skip scanning the new
# table. Identity is not copied: rows inserted through the parent use its sequence.
CREATE_STANDALONE_PARTITION = (
    "CREATE TABLE {partition} (LIKE {table} INCLUDING DEFAULTS INCLUDING CONSTRAINTS "
    "INCLUDING STORAGE INCLUDING COMMENTS INCLUDING STATISTICS INCLUDING GENERATED)"
)
ADD_RANGE_BOUND_CHECK = (
    "ALTER TABLE {partition} ADD CONSTRAINT {name} "
    "CHECK ({column} IS NOT NULL AND {column} >= {start} AND {column} < {end})"
)
ATTACH_RANGE_PARTITION = (
    "ALTER TABLE {table} ATTACH PARTITION {partition} FOR VALUES FROM ({start}) TO ({end})"
)
DROP_CONSTRAINT = "ALTER TABLE {table} DROP CONSTRAINT {name}"

# DETACH ... CONCURRENTLY cannot run inside a transaction block, and is not allowed
# when the table has a default partition. If it is interrupted, the partition is
# left "detach pending" and has to be finished with FINALIZE.
DETACH_PARTITION_CONCURRENTLY = "ALTER TABLE {table} DETACH PARTITION {partition} CONCURRENTLY"
FINALIZE_DETACH_PARTITION = "ALTER TABLE {table} DETACH PARTITION {partition} FINALIZE"
DROP_TABLE = "DROP TABLE {table}"

# Used for statements that take a strong lock on a live partitioned table, when no
# `ZERO_DOWNTIME_MIGRATIONS_LOCK_TIMEOUT` is configured.
DEFAULT_LOCK_TIMEOUT = "5s"
SET_LOCK_TIMEOUT = "SET lock_timeout TO '{timeout}'"
SET_LOCAL_LOCK_TIMEOUT = "SET LOCAL lock_timeout TO '{timeout}'"
RESET_LOCK_TIMEOUT = "SET lock_timeout TO DEFAULT"

# Django schema editor templates, see `Index.create_sql` / `_create_index_sql`.
CREATE_INDEX_ON_ONLY = (
    "CREATE INDEX IF NOT EXISTS %(name)s ON ONLY %(table)s%(using)s "
    "(%(columns)s)%(include)s%(extra)s%(condition)s"
)
CREATE_INDEX_CONCURRENTLY = (
    "CREATE INDEX CONCURRENTLY %(name)s ON %(table)s%(using)s "
    "(%(columns)s)%(include)s%(extra)s%(condition)s"
)
# Partitioned indexes cannot be dropped concurrently. Dropping one is a catalog-only
# change, but it takes an ACCESS EXCLUSIVE lock on the table and its partitions.
DROP_INDEX = "DROP INDEX IF EXISTS %(name)s"
DROP_INDEX_CONCURRENTLY = "DROP INDEX CONCURRENTLY IF EXISTS {name}"
ATTACH_INDEX = "ALTER INDEX {parent} ATTACH PARTITION {child}"

# Catalog queries. All take the unquoted relation name as a parameter.
TABLE_EXISTS = "SELECT to_regclass(%s) IS NOT NULL"
PARTITIONED_TABLE_INFO = """
    SELECT
        pt.partstrat,
        ARRAY(
            SELECT a.attname
            FROM unnest(pt.partattrs::int2[]) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute AS a ON a.attrelid = pt.partrelid AND a.attnum = k.attnum
            ORDER BY k.ord
        )
    FROM pg_partitioned_table AS pt
    WHERE pt.partrelid = to_regclass(%s)
"""
LIST_PARTITIONS = """
    SELECT c.relname, pg_get_expr(c.relpartbound, c.oid), i.inhdetachpending
    FROM pg_inherits AS i
    JOIN pg_class AS c ON c.oid = i.inhrelid
    WHERE i.inhparent = to_regclass(%s)
    ORDER BY c.relname
"""
# Takes the parent index name and the partition name.
ATTACHED_PARTITION_INDEX = """
    SELECT c.relname
    FROM pg_inherits AS h
    JOIN pg_index AS i ON i.indexrelid = h.inhrelid
    JOIN pg_class AS c ON c.oid = i.indexrelid
    WHERE h.inhparent = to_regclass(%s) AND i.indrelid = to_regclass(%s)
"""
INDEX_IS_VALID = "SELECT indisvalid FROM pg_index WHERE indexrelid = to_regclass(%s)"


def timestamp_literal(value: datetime) -> str:
    """SQL literal for a partition bound. Only for datetimes we computed ourselves."""
    if value.tzinfo is None:
        raise ValueError("Partition boundaries require timezone-aware datetimes.")
    return "'{}'".format(value.astimezone(UTC).isoformat(sep=" "))
