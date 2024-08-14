from django.db.migrations import executor, writer
from django.db.models import Field

from sentry.new_migrations.monkey import SENTRY_MIGRATION_TEMPLATE
from sentry.new_migrations.monkey.executor import SentryMigrationExecutor
from sentry.new_migrations.monkey.fields import deconstruct, original_deconstruct
from sentry.testutils.cases import TestCase


class MonkeyTest(TestCase):
    def test(self):
        assert executor.MigrationExecutor is SentryMigrationExecutor
        assert writer.MIGRATION_TEMPLATE == SENTRY_MIGRATION_TEMPLATE
        assert Field.deconstruct == deconstruct != original_deconstruct
