from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class BackfillSeerWorkflowRunSourceTest(TestMigrations):
    app = "seer"
    migrate_from = "0050_rename_agentic_triage_v2"
    migrate_to = "0051_backfill_seerworkflowrun_source"

    def setup_before_migration(self, apps: StateApps) -> None:
        Organization = apps.get_model("sentry", "Organization")
        SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")
        SeerWorkflowRun = apps.get_model("seer", "SeerWorkflowRun")
        with unguarded_write(using="default"):
            organization = Organization.objects.create(slug="migration-org", name="Migration Org")

        def create_run(strategy: str, source: str | None = None) -> int:
            config = SeerWorkflowConfig.objects.create(
                organization_id=organization.id, strategy=strategy
            )
            run = SeerWorkflowRun.objects.create(
                organization_id=organization.id, workflow_config_id=config.id, source=source
            )
            return run.id

        self.cases = {
            "scheduled": (create_run("scheduled_investigation"), "cron"),
            "breached_metric": (create_run("breached_metric_investigation"), "event"),
            "manual": (create_run("scheduled_investigation", source="manual"), "manual"),
            "legacy": (create_run("agentic_triage"), None),
        }
        self.configless_run_id = SeerWorkflowRun.objects.create(organization_id=organization.id).id

    def test_backfills_source_from_strategy(self) -> None:
        SeerWorkflowRun = self.apps.get_model("seer", "SeerWorkflowRun")
        for name, (run_id, expected) in self.cases.items():
            with self.subTest(name):
                assert SeerWorkflowRun.objects.get(id=run_id).source == expected
        assert SeerWorkflowRun.objects.get(id=self.configless_run_id).source is None
