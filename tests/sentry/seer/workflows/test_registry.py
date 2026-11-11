from sentry.incidents.grouptype import MetricIssue
from sentry.seer.models.workflow import SeerWorkflowStrategy
from sentry.seer.workflows.breached_metrics import BreachedMetricWorkflow
from sentry.seer.workflows.registry import get_seer_workflow
from sentry.seer.workflows.workflow import SeerWorkflow
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class GetSeerWorkflowTest(TestCase):
    def test_breached_metric_config_uses_monitor_scope(self) -> None:
        monitored = self.create_project()
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            filters={"all_projects": True},
            monitors=[self.create_detector(project=monitored, type=MetricIssue.slug)],
        )

        seer_workflow = get_seer_workflow(config)

        assert isinstance(seer_workflow, BreachedMetricWorkflow)
        assert (seer_workflow.config_id, seer_workflow.organization_id) == (
            config.id,
            self.organization.id,
        )
        assert seer_workflow.get_project_ids() == [monitored.id]

    def test_other_strategies_use_stored_scope(self) -> None:
        selected = self.create_project()
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_config_project(config, selected)

        seer_workflow = get_seer_workflow(config)

        assert type(seer_workflow) is SeerWorkflow
        assert seer_workflow.get_project_ids() == [selected.id]
