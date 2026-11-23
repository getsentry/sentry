from django.db.migrations.state import StateApps
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class RenameAgenticTriageV2Test(TestMigrations):
    app = "seer"
    migrate_from = "0049_add_seerworkflowrun_source"
    migrate_to = "0050_rename_agentic_triage_v2"

    def setup_before_migration(self, apps: StateApps) -> None:
        Organization = apps.get_model("sentry", "Organization")
        SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")
        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="rename-v2", name="Rename V2")

        self.seeded = SeerWorkflowConfig.objects.create(
            organization_id=org.id,
            strategy="agentic_triage_v2",
            extras={
                "seeded_default": "agentic_triage_v2",
                "trigger_settings": {"cron": "0 9 * * *"},
            },
        )
        self.custom = SeerWorkflowConfig.objects.create(
            organization_id=org.id, strategy="agentic_triage_v2", extras={}
        )
        self.breached = SeerWorkflowConfig.objects.create(
            organization_id=org.id, strategy="breached_metric_investigation", extras={}
        )

    def test_renames_strategy_and_seeded_default(self) -> None:
        SeerWorkflowConfig = self.apps.get_model("seer", "SeerWorkflowConfig")

        seeded = SeerWorkflowConfig.objects.get(id=self.seeded.id)
        assert seeded.strategy == "scheduled_investigation"
        assert seeded.extras == {
            "seeded_default": "scheduled_investigation",
            "trigger_settings": {"cron": "0 9 * * *"},
        }

        custom = SeerWorkflowConfig.objects.get(id=self.custom.id)
        assert custom.strategy == "scheduled_investigation"
        assert custom.extras == {}

        assert SeerWorkflowConfig.objects.get(id=self.breached.id).strategy == (
            "breached_metric_investigation"
        )
