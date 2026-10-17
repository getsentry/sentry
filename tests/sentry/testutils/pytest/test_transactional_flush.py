from __future__ import annotations

import os
import threading
import time
from collections.abc import Callable, Iterator, Sequence
from contextlib import contextmanager
from typing import Any
from unittest import mock

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.contrib.sites.models import Site
from django.db import connections
from django.test import TransactionTestCase as DjangoTransactionTestCase

from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.pytest import transactional_flush as tf
from sentry.testutils.silo import no_silo_test

ALIASES = ("default", "control", "secondary")
WAIT_SECONDS = 30


def _wait_for(condition: Callable[[], bool], what: str) -> None:
    """Poll a condition that another connection's progress makes true."""
    deadline = time.monotonic() + WAIT_SECONDS
    while not condition():
        assert time.monotonic() < deadline, f"timed out waiting for {what}"
        threading.Event().wait(0.01)


def _scalar(alias: str, sql: str, params: Sequence[Any] | None = None) -> object:
    with connections[alias].cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()
        assert row is not None
        return row[0]


def _backend_pid(alias: str) -> int:
    pid = _scalar(alias, "SELECT pg_backend_pid()")
    assert isinstance(pid, int)
    return pid


def _option_rows() -> object:
    return _scalar("default", "SELECT count(*) FROM sentry_option")


def _insert_option_sql(key: str) -> str:
    return (
        "INSERT INTO sentry_option (key, value, last_updated, last_updated_by) "
        f"VALUES ('{key}', '1', now(), 'unknown')"
    )


def _tables_with_rows(alias: str) -> list[str]:
    """Every Django table in the database that holds a row, pages or not."""
    connection = connections[alias]
    qn = connection.ops.quote_name
    with connection.cursor() as cursor:
        tables = tf._existing_tables(connection, cursor)
        cursor.execute(
            " UNION ALL ".join(f"SELECT %s WHERE EXISTS (SELECT 1 FROM {qn(t)})" for t in tables),
            tables,
        )
        return sorted(row[0] for row in cursor.fetchall())


def _post_migrate_contents() -> tuple[list[tuple[str, str]], list[tuple[str, str]], list[str]]:
    """The post_migrate rows without their ids."""
    return (
        sorted(ContentType.objects.values_list("app_label", "model")),
        sorted(Permission.objects.values_list("content_type__app_label", "codename")),
        sorted(Site.objects.values_list("domain", flat=True)),
    )


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
    def flush_all(self) -> None:
        for alias in ALIASES:
            tf.flush_database(alias)

    def assert_flushed(self) -> None:
        """Every table is empty apart from the rows a real Django flush leaves."""
        for alias in ALIASES:
            seeded = tf._post_migrate_rows[tf._cache_key(connections[alias])]
            assert _tables_with_rows(alias) == sorted(seeded.tables), alias
            with connections[alias].cursor() as cursor:
                fingerprint = tf._fingerprint(connections[alias], cursor, seeded.tables)
            assert fingerprint == seeded.fingerprint, alias

    def setUp(self) -> None:
        super().setUp()
        # Each test starts from a recorded flush so none depends on what ran
        # before it in the session.
        self.flush_all()
        self.baseline = _post_migrate_contents()

    def test_orm_and_raw_sql_writes_are_deleted(self) -> None:
        org = self.create_organization(owner=self.create_user())
        project = self.create_project(organization=org)
        self.create_monitor(organization=org, project=project)
        with connections["default"].cursor() as cursor:
            cursor.execute(_insert_option_sql("raw-sql"))
        assert _tables_with_rows("secondary") == ["sentry_monitor"]
        assert "sentry_organization" in _tables_with_rows("default")
        assert "auth_user" in _tables_with_rows("control")

        with _count_django_flushes() as flushed:
            self.flush_all()

        assert flushed == []
        self.assert_flushed()

    def test_toasted_value_is_deleted(self) -> None:
        large = os.urandom(320 * 1024).hex()
        with connections["default"].cursor() as cursor:
            cursor.execute(
                "INSERT INTO sentry_option (key, value, last_updated, last_updated_by) "
                "VALUES ('toast', to_jsonb(%s::text), now(), 'unknown')",
                [large],
            )
        toast_size = _scalar(
            "default",
            "SELECT pg_relation_size(reltoastrelid) FROM pg_class WHERE relname = 'sentry_option'",
        )
        assert isinstance(toast_size, int) and toast_size > 0

        with _count_django_flushes() as flushed:
            self.flush_all()

        assert flushed == []
        assert _option_rows() == 0
        self.assert_flushed()

    def test_changed_post_migrate_rows_fall_back_to_django_flush(self) -> None:
        changes: list[Callable[[], object]] = [
            lambda: ContentType.objects.create(app_label="flushtest", model="thing"),
            lambda: Permission.objects.filter(pk=Permission.objects.order_by("pk")[0].pk).update(
                name="renamed"
            ),
            lambda: Site.objects.all().delete(),
        ]
        for change in changes:
            change()
            with _count_django_flushes() as flushed:
                self.flush_all()
            assert flushed == ["control"]
            assert _post_migrate_contents() == self.baseline
            self.assert_flushed()

    def test_cache_is_keyed_by_database_name(self) -> None:
        connection = connections["control"]
        seeded = tf._post_migrate_rows[tf._cache_key(connection)]
        other = {("control", "some_other_database"): seeded}
        with mock.patch.object(tf, "_post_migrate_rows", other), _count_django_flushes() as flushed:
            tf.flush_database("control")
        assert flushed == ["control"]

    def test_write_during_cleanup_waits_for_it(self) -> None:
        # No pages, so the table is left out of the inventory taken below.
        with connections["default"].cursor() as cursor:
            cursor.execute("TRUNCATE sentry_option")
        cleanup_pid = _backend_pid("default")
        writer_pid: list[int] = []
        committed = threading.Event()

        def writer() -> None:
            try:
                writer_pid.append(_backend_pid("default"))
                with connections["default"].cursor() as cursor:
                    cursor.execute(_insert_option_sql("concurrent"))
                committed.set()
            finally:
                connections["default"].close()

        thread = threading.Thread(target=writer)
        blocked_by_cleanup: list[bool] = []

        def during_cleanup(db_name: str) -> None:
            if db_name != "default":
                return
            thread.start()

            def settled() -> bool:
                if committed.is_set():
                    return True
                if not writer_pid:
                    return False
                blocked = _scalar(
                    "default", "SELECT %s = ANY(pg_blocking_pids(%s))", [cleanup_pid, writer_pid[0]]
                )
                blocked_by_cleanup.append(bool(blocked))
                return bool(blocked)

            _wait_for(settled, "the writer to commit or wait for cleanup")

        with mock.patch.object(tf, "_after_inventory", during_cleanup):
            tf.flush_database("default")
        thread.join(WAIT_SECONDS)

        # Without the lock the insert commits between the inventory and the
        # DELETE, and its row outlives the cleanup.
        assert not thread.is_alive()
        assert blocked_by_cleanup[-1:] == [True]
        assert committed.is_set()
        assert _option_rows() == 1
        tf.flush_database("default")
        assert _option_rows() == 0

    def _flush_with_open_writer(self) -> list[str]:
        cleanup_pid = _backend_pid("default")
        inserted = threading.Event()

        def writer() -> None:
            try:
                with connections["default"].cursor() as cursor:
                    cursor.execute("BEGIN")
                    cursor.execute(_insert_option_sql("open-writer"))
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
        try:
            assert inserted.wait(WAIT_SECONDS)
            with _count_django_flushes() as flushed:
                tf.flush_database("default")
        finally:
            thread.join(WAIT_SECONDS)
        assert not thread.is_alive()
        return flushed

    def test_open_writer_falls_back_to_django_flush(self) -> None:
        flushed = self._flush_with_open_writer()

        assert flushed == ["default"]
        assert _option_rows() == 0
        self.assert_flushed()

    def test_lock_timeout_falls_back_to_django_flush(self) -> None:
        # Skip the open-transaction checks so the writer is only noticed by
        # the lock timing out.
        with (
            mock.patch.object(tf, "_other_transactions_open", return_value=False),
            mock.patch.object(tf, "LOCK_TIMEOUT", "50ms"),
        ):
            flushed = self._flush_with_open_writer()

        assert flushed == ["default"]
        assert _option_rows() == 0
        self.assert_flushed()


class _Case(DjangoTransactionTestCase):
    databases = {"default"}

    def test_nothing(self) -> None:
        pass


@pytest.mark.parametrize(
    ("attribute", "value"), [("available_apps", ["sentry"]), ("serialized_rollback", True)]
)
def test_unsupported_options_use_django_teardown(attribute: str, value: object) -> None:
    case = _Case("test_nothing")
    setattr(case, attribute, value)
    with (
        mock.patch.object(tf, "_original_fixture_teardown") as original,
        mock.patch.object(tf, "flush_database") as flush_database,
    ):
        tf._fixture_teardown(case)
    original.assert_called_once_with(case)
    flush_database.assert_not_called()


def test_default_options_use_fast_flush() -> None:
    case = _Case("test_nothing")
    with (
        mock.patch.object(tf, "_original_fixture_teardown") as original,
        mock.patch.object(tf, "flush_database") as flush_database,
    ):
        tf._fixture_teardown(case)
    original.assert_not_called()
    flush_database.assert_called_once_with("default")


def test_legacy_env_var_keeps_django_teardown(request: pytest.FixtureRequest) -> None:
    original = tf._original_fixture_teardown
    with mock.patch.object(DjangoTransactionTestCase, "_fixture_teardown", original):
        with mock.patch.dict(os.environ, {tf.LEGACY_ENV_VAR: "1"}):
            tf.pytest_configure(request.config)
        assert DjangoTransactionTestCase._fixture_teardown is original  # type: ignore[attr-defined]

        with mock.patch.dict(os.environ, {tf.LEGACY_ENV_VAR: ""}):
            tf.pytest_configure(request.config)
        assert DjangoTransactionTestCase._fixture_teardown is tf._fixture_teardown  # type: ignore[attr-defined]


def test_unconfigure_restores_django_teardown(request: pytest.FixtureRequest) -> None:
    cached = {("default", "test_region"): tf._SeededRows(frozenset(), "")}
    with (
        mock.patch.object(DjangoTransactionTestCase, "_fixture_teardown", tf._fixture_teardown),
        mock.patch.object(tf, "_post_migrate_rows", cached),
    ):
        tf.pytest_unconfigure(request.config)
        assert DjangoTransactionTestCase._fixture_teardown is tf._original_fixture_teardown  # type: ignore[attr-defined]
        assert cached == {}
