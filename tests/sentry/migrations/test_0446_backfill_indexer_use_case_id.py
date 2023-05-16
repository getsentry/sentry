from sentry.sentry_metrics.indexer.postgres.models import PerfStringIndexer
from sentry.testutils.cases import TestMigrations


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

    def test(self):
        for i in PerfStringIndexer.objects.all():
            assert i.use_case_id == "transactions"
