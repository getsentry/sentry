from click.testing import CliRunner
from django.db import connection
from django.test import override_settings

from sentry.runner.commands.migrations import migrations
from sentry.testutils.cases import TransactionTestCase


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
            assert "Running post-deployment migration" in result.output
            assert "Migration complete" in result.output

            queries = [q["sql"] for q in connection.queries]
            expected = 'CREATE INDEX CONCURRENTLY "migration_run_test_name_idx" ON "migration_test_app_migrationruntest" ("name")'
            assert expected in queries, queries
