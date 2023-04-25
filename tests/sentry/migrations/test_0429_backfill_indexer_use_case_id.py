from sentry.sentry_metrics.indexer.postgres.models import PerfStringIndexer
from sentry.testutils.cases import TestMigrations


class PerfIndexerUseCaseIdBackfillTest(TestMigrations):
    migrate_from = "0428_backfill_denormalize_notification_actor"
    migrate_to = "0429_backfill_indexer_use_case_id"

    def setup_before_migration(self, apps):
        PerfStringIndexer = apps.get_model("sentry", "PerfStringIndexer")
        PerfStringIndexer.objects.create(string="hello", organization_id=12)
        PerfStringIndexer.objects.create(string="bye", organization_id=12)

    def test(self):
        for i in PerfStringIndexer.objects.all():
            assert i.use_case_id == "transactions"
