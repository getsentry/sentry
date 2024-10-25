from __future__ import annotations

from unittest.mock import patch

from click.testing import CliRunner
from django.db import connections, router
from django.test import override_settings

from sentry.runner.commands.migrations import migrations
from sentry.testutils.cases import TransactionTestCase


def filter_queries(needle: str, queries: list) -> list[str]:
    return list(filter(lambda sql: needle in sql, queries))


class MigrationsRunTest(TransactionTestCase):
    command = migrations

    # Copy paste from CliTest as this test needs to escape auto transactions
    @property
    def runner(self) -> CliRunner:
        return CliRunner()

    def invoke(self, *args, **kwargs):
        return self.runner.invoke(self.command, args, obj={}, **kwargs)

    def test_index_creation(self):
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

    def test_migration_skipped_by_router(self):
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
