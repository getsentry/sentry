from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations


class HideBackingWorkflowsTest(TestMigrations):
    app = "seer"
    migrate_from = "0046_add_workflow_config_backing_workflow"
    migrate_to = "0047_hide_backing_workflows"

    def setup_before_migration(self, apps: StateApps) -> None:
        Organization = apps.get_model("sentry", "Organization")
        Workflow = apps.get_model("workflow_engine", "Workflow")
        SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")

        with unguarded_write(using="default"):
            org = Organization.objects.create(slug="backing-workflows", name="Backing Workflows")

        self.backing = Workflow.objects.create(organization_id=org.id, name="Seer automation")
        SeerWorkflowConfig.objects.create(
            organization_id=org.id,
            strategy="breached_metric_investigation",
            backing_workflow_id=self.backing.id,
        )
        SeerWorkflowConfig.objects.create(
            organization_id=org.id, strategy="breached_metric_investigation"
        )
        self.alert = Workflow.objects.create(organization_id=org.id, name="Alert")
        self.inbox = Workflow.objects.create(organization_id=org.id, name="Inbox", type="inbox")

    def test(self) -> None:
        for workflow, expected in (
            (self.backing, "seer_automation"),
            (self.alert, "alert"),
            (self.inbox, "inbox"),
        ):
            with self.subTest(workflow.name):
                workflow.refresh_from_db()
                assert workflow.type == expected
