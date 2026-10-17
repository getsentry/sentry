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

Set ``SENTRY_LEGACY_TRANSACTIONAL_FLUSH=1`` to keep Django's own teardown.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Collection, Sequence
from dataclasses import dataclass

import pytest
from django.core.management import call_command
from django.db import OperationalError, connections, transaction
from django.db.backends.base.base import BaseDatabaseWrapper
from django.db.backends.utils import CursorWrapper
from django.test import TransactionTestCase

from sentry.silo.safety import unguarded_write

LEGACY_ENV_VAR = "SENTRY_LEGACY_TRANSACTIONAL_FLUSH"

# A writer that is still open when cleanup starts makes the lock wait. Give up
# quickly and let Django's flush wait for it instead, as TRUNCATE always has.
LOCK_TIMEOUT = "1s"

# lock_not_available and deadlock_detected.
_LOCK_FAILURES = frozenset({"55P03", "40P01"})


@dataclass(frozen=True)
class _SeededRows:
    """The tables that held rows right after Django's flush and post_migrate
    last ran, and a fingerprint of those rows."""

    tables: frozenset[str]
    fingerprint: str


# Keyed by alias and database name: the test databases get renamed per xdist
# worker, and a session may point one alias at another database.
_post_migrate_rows: dict[tuple[str, str], _SeededRows] = {}

# Tests set this to run code while the tables are locked and the inventory of
# rows to delete has been taken.
_after_inventory: Callable[[str], None] | None = None


class _NeedsDjangoFlush(Exception):
    pass


def _cache_key(connection: BaseDatabaseWrapper) -> tuple[str, str]:
    return (connection.alias, str(connection.settings_dict["NAME"]))


def _existing_tables(connection: BaseDatabaseWrapper, cursor: CursorWrapper) -> list[str]:
    """The tables Django's flush would truncate."""
    names = connection.introspection.django_table_names(include_views=False)
    cursor.execute(
        """
        SELECT relname FROM pg_class
        WHERE relkind IN ('r', 'p')
          AND pg_table_is_visible(oid)
          AND relname = ANY(%s)
        ORDER BY relname
        """,
        [names],
    )
    return [row[0] for row in cursor.fetchall()]


def _tables_with_pages(cursor: CursorWrapper, tables: Sequence[str]) -> frozenset[str]:
    """
    The tables that may hold rows.

    A table that has never had rows has no pages, and checking that does not
    load each table's metadata, so it stays cheap on a fresh connection.
    """
    cursor.execute(
        """
        SELECT relname FROM pg_class
        WHERE relkind IN ('r', 'p')
          AND pg_table_is_visible(oid)
          AND relname = ANY(%s)
          AND (relkind = 'p' OR pg_relation_size(oid) > 0)
        """,
        [list(tables)],
    )
    return frozenset(row[0] for row in cursor.fetchall())


def _lock_tables(connection: BaseDatabaseWrapper, cursor: CursorWrapper) -> list[str]:
    """
    Block writes to every table until the transaction ends, so no row can be
    committed between taking the inventory and deleting. Reads still go
    through.
    """
    tables = _existing_tables(connection, cursor)
    qn = connection.ops.quote_name
    cursor.execute("SELECT set_config('lock_timeout', %s, true)", [LOCK_TIMEOUT])
    cursor.execute(f"LOCK TABLE {', '.join(qn(t) for t in tables)} IN EXCLUSIVE MODE")
    return tables


def _other_transactions_open(cursor: CursorWrapper) -> bool:
    """
    TRUNCATE waits for every other open transaction on its tables (a leaked
    thread, say) to finish and then removes its rows too. The lock already
    waits for writers; a transaction that has only read so far could still
    write once the lock is released, so leave that case to Django's flush.
    """
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND xact_start IS NOT NULL
        )
        """
    )
    row = cursor.fetchone()
    return bool(row and row[0])


def _fingerprint(
    connection: BaseDatabaseWrapper, cursor: CursorWrapper, tables: Collection[str]
) -> str:
    if not tables:
        return ""
    qn = connection.ops.quote_name
    sql = " UNION ALL ".join(
        f"SELECT %s, md5(coalesce(string_agg(r::text, ',' ORDER BY r::text), '')) FROM {qn(name)} r"
        for name in tables
    )
    cursor.execute(sql, list(tables))
    return repr(sorted(cursor.fetchall()))


def _is_lock_failure(error: OperationalError) -> bool:
    return getattr(error.__cause__, "pgcode", None) in _LOCK_FAILURES


def _record_seeded_rows(db_name: str) -> None:
    connection = connections[db_name]
    key = _cache_key(connection)
    _post_migrate_rows.pop(key, None)
    try:
        with transaction.atomic(using=db_name), connection.cursor() as cursor:
            tables = _lock_tables(connection, cursor)
            if _other_transactions_open(cursor):
                # Another connection could be about to write a row that would
                # then be mistaken for one of post_migrate's.
                return
            # TRUNCATE leaves every table without pages, so the tables that
            # have pages now are the ones post_migrate wrote to.
            seeded = _tables_with_pages(cursor, tables)
            _post_migrate_rows[key] = _SeededRows(seeded, _fingerprint(connection, cursor, seeded))
    except OperationalError as e:
        if not _is_lock_failure(e):
            raise


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
    _record_seeded_rows(db_name)


def _delete_rows(db_name: str, seeded: _SeededRows) -> None:
    connection = connections[db_name]
    with transaction.atomic(using=db_name), connection.cursor() as cursor:
        tables = _lock_tables(connection, cursor)
        if _other_transactions_open(cursor):
            raise _NeedsDjangoFlush
        with_pages = _tables_with_pages(cursor, tables)
        if (
            not seeded.tables <= with_pages
            or _fingerprint(connection, cursor, seeded.tables) != seeded.fingerprint
        ):
            raise _NeedsDjangoFlush
        to_delete = sorted(with_pages - seeded.tables)
        if _after_inventory is not None:
            _after_inventory(db_name)
        if not to_delete:
            return
        # Foreign keys are deferred, so the order of the deletes does not
        # matter. The fence keeps the outbox write audit from flagging the
        # deletes. It wraps only the deletes because its closing query would
        # fail in a transaction that a lock timeout has aborted.
        qn = connection.ops.quote_name
        with unguarded_write(using=db_name):
            cursor.execute("; ".join(f"DELETE FROM {qn(t)}" for t in to_delete))


def flush_database(db_name: str) -> None:
    connection = connections[db_name]
    seeded = _post_migrate_rows.get(_cache_key(connection))
    if seeded is None:
        _django_flush(db_name)
        return
    with connection.cursor() as cursor:
        # Checked again under the lock; this only skips waiting out
        # LOCK_TIMEOUT behind a transaction that is already known to be open.
        if _other_transactions_open(cursor):
            _django_flush(db_name)
            return
    try:
        _delete_rows(db_name, seeded)
    except _NeedsDjangoFlush:
        _django_flush(db_name)
    except OperationalError as e:
        if not _is_lock_failure(e):
            raise
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
    if os.environ.get(LEGACY_ENV_VAR) == "1":
        return
    TransactionTestCase._fixture_teardown = _fixture_teardown  # type: ignore[attr-defined]


def pytest_unconfigure(config: pytest.Config) -> None:
    TransactionTestCase._fixture_teardown = _original_fixture_teardown  # type: ignore[attr-defined]
    _post_migrate_rows.clear()
