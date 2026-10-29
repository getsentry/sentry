from django.apps.registry import Apps
from django.db import connections
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

from sentry.new_migrations.monkey.state import SentryProjectState
from sentry.testutils.cases import TestMigrations


class MoveAutomationsTest(TestMigrations):
    app = "seer"
    migrate_from = "0045_workflow_run_lifecycle"
    migrate_to = "0046_move_automations"

    def setup_initial_state(self) -> None:
        self.organization_id = self.create_organization().id

    def setup_before_migration(self, apps: Apps) -> None:
        organization = apps.get_model("sentry", "Organization").objects.get(id=self.organization_id)
        project = apps.get_model("sentry", "Project").objects.create(
            organization=organization, name="Project", slug="project"
        )
        action = apps.get_model("workflow_engine", "Action").objects.create(
            type="seer_workflow", config={}
        )
        seer_run = apps.get_model("seer", "SeerRun").objects.create(
            organization=organization, type="feature_run", last_triggered_at=timezone.now()
        )
        self.config = apps.get_model("seer", "SeerWorkflowConfig").objects.create(
            organization=organization,
            strategy="breached_metric_investigation",
            enabled=True,
            version=4,
            service_account_id=123,
            filters={"environments": ["production"]},
            output_policy={"notify": True},
        )
        self.project_link = apps.get_model("seer", "SeerWorkflowConfigProject").objects.create(
            config=self.config, project=project
        )
        self.binding = apps.get_model("seer", "SeerWorkflowTriggerBinding").objects.create(
            workflow_config=self.config, trigger_action=action
        )
        self.workflow_run = apps.get_model("seer", "SeerWorkflowRun").objects.create(
            organization=organization,
            workflow_config=self.config,
            trigger_key="example-trigger",
            status="running",
            extras={"snapshot": {"config_version": 4}},
        )
        self.execution = apps.get_model("seer", "SeerWorkflowRunExecution").objects.create(
            run=self.workflow_run, seer_run=seer_run, status="running", extras={"example": True}
        )
        self.result = apps.get_model("seer", "SeerAgenticTriageRunResult").objects.create(
            run=self.workflow_run,
            kind="agentic_triage",
            idempotency_key="example-result",
            result_seer_run=seer_run,
            extras={"action": "autofix"},
        )
        self.constraints = self.get_automation_constraints()

    def test_existing_rows_and_constraints_survive_the_app_move(self) -> None:
        # Complete the transfer to the new app after seer releases its model state.
        executor = MigrationExecutor(connections[self.connection])
        state = executor.migrate(
            [("seer_automations", "0001_initial")], state=self._project_state_cache
        )
        assert isinstance(state, SentryProjectState)
        self._project_state_cache = state
        apps = state.apps

        config = apps.get_model("seer_automations", "SeerWorkflowConfig").objects.get(
            id=self.config.id
        )
        assert config.organization_id == self.config.organization_id
        assert config.service_account_id == 123
        assert config.enabled is True
        assert config.version == 4
        assert config.filters == {"environments": ["production"]}
        assert config.output_policy == {"notify": True}
        assert config.date_added == self.config.date_added

        project_link = apps.get_model("seer_automations", "SeerWorkflowConfigProject").objects.get(
            id=self.project_link.id
        )
        assert project_link.config_id == config.id
        assert project_link.project_id == self.project_link.project_id

        binding = apps.get_model("seer_automations", "SeerWorkflowTriggerBinding").objects.get(
            id=self.binding.id
        )
        assert binding.workflow_config_id == config.id
        assert binding.trigger_action_id == self.binding.trigger_action_id

        run = apps.get_model("seer_automations", "SeerWorkflowRun").objects.get(
            id=self.workflow_run.id
        )
        assert run.workflow_config_id == config.id
        assert run.organization_id == self.workflow_run.organization_id
        assert run.trigger_key == "example-trigger"
        assert run.status == "running"
        assert run.extras == {"snapshot": {"config_version": 4}}

        execution = apps.get_model("seer_automations", "SeerWorkflowRunExecution").objects.get(
            id=self.execution.id
        )
        assert execution.run_id == run.id
        assert execution.seer_run_id == self.execution.seer_run_id
        assert execution.status == "running"
        assert execution.extras == {"example": True}

        result = apps.get_model("seer_automations", "SeerAgenticTriageRunResult").objects.get(
            id=self.result.id
        )
        assert result.run_id == run.id
        assert result.result_seer_run_id == self.result.result_seer_run_id
        assert result.idempotency_key == "example-result"
        assert result.extras == {"action": "autofix"}
        assert self.get_automation_constraints() == self.constraints

        notebook = apps.get_model("notebooks", "Notebook").objects.create(
            organization_id=run.organization_id, title="Example output"
        )
        link = apps.get_model("seer_automations", "SeerWorkflowOutputLink").objects.create(
            execution=execution, notebook=notebook
        )
        assert execution.output_links.get().id == link.id

    def get_automation_constraints(self) -> dict[str, object]:
        connection = connections[self.connection]
        with connection.cursor() as cursor:
            return {
                table: connection.introspection.get_constraints(cursor, table)
                for table in (
                    "seer_workflowconfig",
                    "seer_workflowconfigproject",
                    "seer_workflowtriggerbinding",
                    "seer_nightshiftrun",
                    "seer_nightshiftrunshard",
                    "seer_nightshiftrunissue",
                )
            }
