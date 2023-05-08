from sentry.sentry_metrics.indexer.postgres.models import PerfStringIndexer
from sentry.testutils.cases import TestMigrations


class PerfIndexerUseCaseIdBackfillTest(TestMigrations):
    migrate_from = "0447_add_expected_time_config_to_cron_checkin"
    migrate_to = "0448_add_expected_time_config_to_cron_checkin"

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
