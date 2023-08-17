import pytest

from sentry.sentry_metrics.indexer.postgres.models import PerfStringIndexer
from sentry.testutils.cases import TestMigrations


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class PerfIndexerUseCaseIdBackfillTest(TestMigrations):
    migrate_from = "0445_drop_deprecated_monitor_next_last_checkin_db_op"
    migrate_to = "0446_backfill_indexer_use_case_id"

    def setup_before_migration(self, apps):
        PerfStringIndexer = apps.get_model("sentry", "PerfStringIndexer")
        PerfStringIndexer.objects.create(
            string="hello", organization_id=12, use_case_id="performance"
        )
        PerfStringIndexer.objects.create(
            string="bye", organization_id=12, use_case_id="performance"
        )
        # testing that new records with same string/org and new use_case_id
        # may already been created at the time of the backfill
        PerfStringIndexer.objects.create(
            string="bye", organization_id=12, use_case_id="transactions"
        )

    def test(self):
        # "hello" recprd should have been changed to "transactions"
        assert not PerfStringIndexer.objects.filter(string="hello", use_case_id="performance")
        # we keep the old performance record because we already have
        # the new use_case_id
        assert len(PerfStringIndexer.objects.filter(string="bye")) == 2
