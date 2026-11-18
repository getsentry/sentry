from typing import Any

from django.db.migrations.state import StateApps

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import Action, Workflow


class ConvertSeerWorkflowActionsTest(TestMigrations):
    app = "seer"
    migrate_from = "0046_add_workflow_config_backing_workflow"
    migrate_to = "0047_convert_seer_workflow_actions"

    def setup_before_migration(self, apps: StateApps) -> None:
        HistoricalAction = apps.get_model("workflow_engine", "Action")
        Organization = apps.get_model("sentry", "Organization")
        SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")
        HistoricalWorkflow = apps.get_model("workflow_engine", "Workflow")
        SeerWorkflowTriggerBinding = apps.get_model("seer", "SeerWorkflowTriggerBinding")

        self.seer_action = HistoricalAction.objects.create(type="seer_workflow", config={}, data={})
        self.email_action = HistoricalAction.objects.create(type="email", config={}, data={})

        with unguarded_write(using="default"):
            organization = Organization.objects.create(slug="migration-org", name="Migration")

        def config_with_workflow(workflow_name: str, extras: dict[str, object]) -> Any:
            workflow = HistoricalWorkflow.objects.create(
                organization=organization, name=workflow_name, config={}
            )
            return SeerWorkflowConfig.objects.create(
                organization=organization,
                strategy="breached_metric_investigation",
                backing_workflow=workflow,
                extras=extras,
            )

        defaulted = config_with_workflow(
            "Seer automation", {"name": "Checkout latency", "created_by": 42}
        )
        SeerWorkflowTriggerBinding.objects.create(
            workflow_config=defaulted, trigger_action=self.seer_action
        )
        self.defaulted = defaulted.backing_workflow_id
        self.renamed = config_with_workflow(
            "Already renamed", {"name": "Old name"}
        ).backing_workflow_id
        self.unnamed = config_with_workflow("Seer automation", {}).backing_workflow_id

    def test_converts_actions_and_updates_backing_workflows(self) -> None:
        assert Action.objects.get(id=self.seer_action.id).type == "seer_investigation"
        assert Action.objects.get(id=self.email_action.id).type == "email"

        defaulted = Workflow.objects.get(id=self.defaulted)
        assert (defaulted.name, defaulted.created_by_id) == ("Checkout latency", 42)
        assert Workflow.objects.get(id=self.renamed).name == "Already renamed"
        unnamed = Workflow.objects.get(id=self.unnamed)
        assert (unnamed.name, unnamed.created_by_id) == ("Seer automation", None)
        assert set(
            Workflow.objects.filter(
                id__in=[self.defaulted, self.renamed, self.unnamed]
            ).values_list("type", flat=True)
        ) == {Workflow.Type.SEER_INVESTIGATION}
