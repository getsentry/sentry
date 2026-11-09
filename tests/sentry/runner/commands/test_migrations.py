from __future__ import annotations

import os
import signal
import threading
import time
from typing import Any
from unittest.mock import patch

from click.testing import CliRunner, Result
from django.db import connections, router
from django.test import override_settings

from sentry.runner.commands.migrations import migrations
from sentry.testutils.cases import TransactionTestCase


def filter_queries(needle: str, queries: list[str]) -> list[str]:
    return list(filter(lambda sql: needle in sql, queries))


class MigrationsRunTest(TransactionTestCase):
    command = migrations

    # Copy paste from CliTest as this test needs to escape auto transactions
    @property
    def runner(self) -> CliRunner:
        return CliRunner()

    def invoke(self, *args: str, **kwargs: Any) -> Result:
        return self.runner.invoke(self.command, args, obj={}, **kwargs)

    def test_index_creation(self) -> None:
        with override_settings(
            INSTALLED_APPS=("fixtures.safe_migrations_apps.migration_test_app",),
            MIGRATION_MODULES={},
        ):
            result = self.invoke("run", "migration_test_app", "0001")

            assert result.exit_code == 0, result.output
            assert "Running post-deployment migration for default" in result.output
            assert "Running post-deployment migration for control" in result.output
            assert "Migration complete" in result.output

            connection = connections["default"]
            queries = [q["sql"] for q in connection.queries]

            expected = 'CREATE INDEX CONCURRENTLY "migration_run_test_name_idx" ON "migration_test_app_migrationruntest" ("name")'
            assert expected in queries, queries

            matched = filter_queries("CREATE INDEX CONCURRENTLY", queries)
            assert len(matched) == 1

            matched = filter_queries('CREATE INDEX "migration_run_test_name_idx"', queries)
            assert len(matched) == 0

            for conn_name in connections:
                connection = connections[conn_name]
                if connection.alias == "default":
                    continue
                queries = [q["sql"] for q in connection.queries]

                matched = filter_queries("CREATE TABLE", queries)
                assert len(matched) == 0

                matched = filter_queries("CREATE INDEX", queries)
                assert len(matched) == 0

    def test_migration_skipped_by_router(self) -> None:
        with (
            override_settings(
                INSTALLED_APPS=("fixtures.safe_migrations_apps.migration_test_app",),
                MIGRATION_MODULES={},
            ),
            patch.object(router, "allow_migrate") as mock_allow,
        ):
            mock_allow.return_value = False

            result = self.invoke("run", "migration_test_app", "0001")
            assert result.exit_code == 0, result.output
            assert "Migration complete" in result.output

            for conn_name in connections:
                connection = connections[conn_name]
                queries = [q["sql"] for q in connection.queries]

                matched = filter_queries("CREATE TABLE", queries)
                assert len(matched) == 0

                matched = filter_queries("CREATE INDEX", queries)
                assert len(matched) == 0

    def test_sigterm_cancels_running_query(self) -> None:
        original_handler = signal.getsignal(signal.SIGTERM)

        def send_sigterm() -> None:
            # Wait for the command to install its handler, then give the
            # worker thread a moment to start the slow query.
            deadline = time.monotonic() + 10
            while signal.getsignal(signal.SIGTERM) is original_handler:
                assert time.monotonic() < deadline
                time.sleep(0.05)
            time.sleep(0.5)
            os.kill(os.getpid(), signal.SIGTERM)

        killer = threading.Thread(target=send_sigterm)
        with override_settings(
            INSTALLED_APPS=("fixtures.safe_migrations_apps.migration_test_app",),
            MIGRATION_MODULES={},
        ):
            killer.start()
            start = time.monotonic()
            result = self.invoke("run", "migration_test_app", "0002")
            elapsed = time.monotonic() - start
            killer.join()

        assert result.exit_code == 128 + signal.SIGTERM, result.output
        assert "FAIL" in result.output
        assert "Received SIGTERM, cancelling running queries" in result.output
        assert "Migration complete" not in result.output
        # The migration sleeps for 60s, so a short run means the query was cancelled.
        assert elapsed < 30
        assert signal.getsignal(signal.SIGTERM) is original_handler
