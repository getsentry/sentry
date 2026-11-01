"""
Faster database flush when a transactional test (``TransactionTestCase`` or
``@django_db_all(transaction=True)``) tears down.

Django flushes each database after every transactional test with one
``TRUNCATE`` of every table, then emits ``post_migrate`` so the contenttypes,
auth, and sites apps recreate their rows. ``TRUNCATE`` swaps in new files for
every table and index, even empty ones, and the ``post_migrate`` receivers run
dozens of queries to put back rows that were already there. Across the test
databases that adds up to more than a second per test.

Instead, rows are removed with ``DELETE`` from the tables that have ever had
any (an empty table has no pages on disk). Tables whose only rows are the ones
``post_migrate`` created are left alone while their contents still match what
the last real flush produced, so ``post_migrate`` does not have to run again.
When they don't match, Django's flush runs. Either way every table ends up
empty apart from the ``post_migrate`` rows.

The tables stay locked while the rows are counted and deleted, so a row
committed in between can't outlive the test.
"""

from __future__ import annotations

from collections.abc import Collection

import pytest
from django.core.management import call_command
from django.db import OperationalError, connections, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.test import TransactionTestCase

from sentry.silo.safety import unguarded_write

# For each database alias: the tables that held rows right after Django's flush
# and post_migrate last ran, and a fingerprint of those rows.
_post_migrate_rows: dict[str, tuple[frozenset[str], str]] = {}


def _tables_with_pages(connection: BaseDatabaseWrapper) -> frozenset[str]:
    """
    Tables that Django's flush would truncate and that may hold rows.

    A table that has never had rows has no pages, and checking that does not
    load each table's metadata, so it stays cheap on a fresh connection.
    """
    names = connection.introspection.django_table_names(include_views=False)
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT relname FROM pg_class
            WHERE relkind IN ('r', 'p')
              AND pg_table_is_visible(oid)
              AND relname = ANY(%s)
              AND (relkind = 'p' OR pg_relation_size(oid) > 0)
            """,
            [names],
        )
        return frozenset(row[0] for row in cursor.fetchall())


def _lock_tables(connection: BaseDatabaseWrapper) -> None:
    """
    Takes the same lock as TRUNCATE. DELETE can't see another transaction's
    uncommitted rows, so if one has touched any table (a leaked thread, say)
    this times out and Django's TRUNCATE waits for it instead.
    """
    tables = connection.introspection.django_table_names(only_existing=True, include_views=False)
    qn = connection.ops.quote_name
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL lock_timeout = '1s'")
        cursor.execute(f"LOCK TABLE {', '.join(qn(t) for t in tables)} IN ACCESS EXCLUSIVE MODE")


def _fingerprint(connection: BaseDatabaseWrapper, tables: Collection[str]) -> str:
    if not tables:
        return ""
    qn = connection.ops.quote_name
    sql = " UNION ALL ".join(
        f"SELECT %s, md5(coalesce(string_agg(r::text, ',' ORDER BY r::text), '')) FROM {qn(name)} r"
        for name in tables
    )
    with connection.cursor() as cursor:
        cursor.execute(sql, list(tables))
        return repr(sorted(cursor.fetchall()))


def _django_flush(db_name: str) -> None:
    call_command(
        "flush",
        verbosity=0,
        interactive=False,
        database=db_name,
        reset_sequences=False,
        allow_cascade=False,
        inhibit_post_migrate=False,
    )
    # TRUNCATE leaves every table without pages, so the tables that have pages
    # now are the ones post_migrate wrote to.
    connection = connections[db_name]
    seeded = _tables_with_pages(connection)
    _post_migrate_rows[db_name] = (seeded, _fingerprint(connection, seeded))


def _delete_rows(db_name: str, seeded: tuple[frozenset[str], str]) -> bool:
    """Delete every row post_migrate didn't create, or return False if that isn't safe."""
    connection = connections[db_name]
    try:
        with transaction.atomic(using=db_name):
            _lock_tables(connection)
            tables = _tables_with_pages(connection)
            if not seeded[0] <= tables or _fingerprint(connection, seeded[0]) != seeded[1]:
                return False
            to_delete = sorted(tables - seeded[0])
            if to_delete:
                # Foreign keys are deferred, so the order of the deletes does
                # not matter. The fence keeps the outbox write audit from
                # flagging the deletes.
                qn = connection.ops.quote_name
                with unguarded_write(using=db_name), connection.cursor() as cursor:
                    cursor.execute("; ".join(f"DELETE FROM {qn(t)}" for t in to_delete))
    except OperationalError as e:
        # lock_not_available or deadlock_detected
        if getattr(e.__cause__, "pgcode", None) not in ("55P03", "40P01"):
            raise
        return False
    return True


def flush_database(db_name: str) -> None:
    seeded = _post_migrate_rows.get(db_name)
    if seeded is None or not _delete_rows(db_name, seeded):
        _django_flush(db_name)


_original_fixture_teardown = TransactionTestCase._fixture_teardown  # type: ignore[attr-defined]


def _fixture_teardown(self: TransactionTestCase) -> None:
    db_names = self._databases_names(include_mirrors=False)  # type: ignore[attr-defined]
    if (
        self.available_apps is not None
        or self.serialized_rollback
        or any(connections[db_name].vendor != "postgresql" for db_name in db_names)
    ):
        return _original_fixture_teardown(self)

    for db_name in db_names:
        flush_database(db_name)


def pytest_configure(config: pytest.Config) -> None:
    TransactionTestCase._fixture_teardown = _fixture_teardown  # type: ignore[attr-defined]


def pytest_unconfigure(config: pytest.Config) -> None:
    TransactionTestCase._fixture_teardown = _original_fixture_teardown  # type: ignore[attr-defined]
    _post_migrate_rows.clear()
