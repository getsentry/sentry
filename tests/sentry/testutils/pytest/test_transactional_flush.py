from __future__ import annotations

import os
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any
from unittest import mock

from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.contrib.sites.models import Site
from django.db import connections
from django.db.backends.base.base import BaseDatabaseWrapper

from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.pytest import transactional_flush as tf
from sentry.testutils.silo import no_silo_test

ALIASES = ("default", "control", "secondary")
WAIT_SECONDS = 30


def _wait_for(condition: Callable[[], bool], what: str) -> None:
    deadline = time.monotonic() + WAIT_SECONDS
    while not condition():
        assert time.monotonic() < deadline, f"timed out waiting for {what}"
        time.sleep(0.01)


def _scalar(sql: str, params: list[Any] | None = None) -> Any:
    with connections["default"].cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()
        assert row is not None
        return row[0]


def _insert_option(key: str) -> None:
    with connections["default"].cursor() as cursor:
        cursor.execute(
            "INSERT INTO sentry_option (key, value, last_updated, last_updated_by) "
            "VALUES (%s, to_jsonb(%s::text), now(), 'unknown')",
            [key, os.urandom(320 * 1024).hex()],
        )


def _tables_with_rows(alias: str) -> list[str]:
    connection = connections[alias]
    qn = connection.ops.quote_name
    tables = connection.introspection.django_table_names(only_existing=True, include_views=False)
    with connection.cursor() as cursor:
        cursor.execute(
            " UNION ALL ".join(f"SELECT %s WHERE EXISTS (SELECT 1 FROM {qn(t)})" for t in tables),
            tables,
        )
        return sorted(row[0] for row in cursor.fetchall())


@contextmanager
def _count_django_flushes() -> Iterator[list[str]]:
    flushed: list[str] = []
    original = tf._django_flush

    def spy(db_name: str) -> None:
        flushed.append(db_name)
        original(db_name)

    with mock.patch.object(tf, "_django_flush", spy):
        yield flushed


@no_silo_test
class TransactionalFlushTest(TransactionTestCase):
    def setUp(self) -> None:
        super().setUp()
        # Start from a recorded flush so no test depends on what ran before.
        for alias in ALIASES:
            tf.flush_database(alias)

    def assert_flushed(self) -> None:
        for alias in ALIASES:
            seeded_tables, _ = tf._post_migrate_rows[alias]
            assert _tables_with_rows(alias) == sorted(seeded_tables), alias

    def test_deletes_rows_in_every_database(self) -> None:
        org = self.create_organization(owner=self.create_user())
        self.create_monitor(organization=org, project=self.create_project(organization=org))
        _insert_option("raw-sql-and-toast")

        with _count_django_flushes() as flushed:
            for alias in ALIASES:
                tf.flush_database(alias)

        assert flushed == []
        self.assert_flushed()

    def test_changed_post_migrate_rows_fall_back_to_django_flush(self) -> None:
        baseline = sorted(Permission.objects.values_list("codename", "name"))
        Permission.objects.filter(pk=Permission.objects.order_by("pk")[0].pk).update(name="x")
        ContentType.objects.create(app_label="flushtest", model="thing")
        Site.objects.all().delete()

        with _count_django_flushes() as flushed:
            tf.flush_database("control")

        assert flushed == ["control"]
        assert sorted(Permission.objects.values_list("codename", "name")) == baseline
        assert not ContentType.objects.filter(app_label="flushtest").exists()
        assert Site.objects.exists()

    def test_write_during_cleanup_is_deleted(self) -> None:
        # An empty table has no pages, so it's left out of the inventory.
        with connections["default"].cursor() as cursor:
            cursor.execute("TRUNCATE sentry_option")
        cleanup_pid = _scalar("SELECT pg_backend_pid()")
        writer_pid: list[object] = []

        def writer() -> None:
            try:
                writer_pid.append(_scalar("SELECT pg_backend_pid()"))
                _insert_option("concurrent")
            finally:
                connections["default"].close()

        thread = threading.Thread(target=writer)
        original = tf._tables_with_pages

        def inventory_then_write(connection: BaseDatabaseWrapper) -> frozenset[str]:
            tables = original(connection)
            if connection.alias == "default":
                thread.start()
                # Without the lock the insert would commit right here.
                _wait_for(
                    lambda: bool(writer_pid)
                    and bool(
                        _scalar(
                            "SELECT %s = ANY(pg_blocking_pids(%s))", [cleanup_pid, writer_pid[0]]
                        )
                    ),
                    "the writer to wait for cleanup",
                )
            return tables

        with mock.patch.object(tf, "_tables_with_pages", inventory_then_write):
            tf.flush_database("default")
        thread.join(WAIT_SECONDS)

        assert _scalar("SELECT count(*) FROM sentry_option") == 1
        tf.flush_database("default")
        assert _scalar("SELECT count(*) FROM sentry_option") == 0

    def test_open_writer_falls_back_to_django_flush(self) -> None:
        cleanup_pid = _scalar("SELECT pg_backend_pid()")
        inserted = threading.Event()

        def writer() -> None:
            try:
                with connections["default"].cursor() as cursor:
                    cursor.execute("BEGIN")
                    cursor.execute(
                        "INSERT INTO sentry_option (key, value, last_updated, last_updated_by) "
                        "VALUES ('open-writer', '1', now(), 'unknown')"
                    )
                    inserted.set()

                    def truncate_waits() -> bool:
                        cursor.execute("SELECT pg_stat_clear_snapshot()")
                        cursor.execute(
                            "SELECT query, wait_event_type FROM pg_stat_activity WHERE pid = %s",
                            [cleanup_pid],
                        )
                        query, wait_event_type = cursor.fetchone()
                        return query.startswith("TRUNCATE") and wait_event_type == "Lock"

                    _wait_for(truncate_waits, "Django's flush to wait for the writer")
                    cursor.execute("COMMIT")
            finally:
                connections["default"].close()

        thread = threading.Thread(target=writer)
        thread.start()
        assert inserted.wait(WAIT_SECONDS)
        with _count_django_flushes() as flushed:
            tf.flush_database("default")
        thread.join(WAIT_SECONDS)

        assert flushed == ["default"]
        assert _scalar("SELECT count(*) FROM sentry_option") == 0
