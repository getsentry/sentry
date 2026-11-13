from sentry.incidents.grouptype import MetricIssue
from sentry.seer.models.workflow import (
    SeerWorkflowStrategy,
)
from sentry.seer.workflows.definitions import find_definition, get_definition, is_scheduled
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories


class GetDefinitionTest(TestCase):
    def test_metric_alert_trigger_scopes_by_connected_monitors(self) -> None:
        monitored = self.create_project()
        config = Factories.create_seer_workflow_config(
            self.organization,
            strategy=SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION,
            filters={"all_projects": True},
            monitors=[self.create_detector(project=monitored, type=MetricIssue.slug)],
        )

        definition = get_definition(config.strategy)

        assert definition.trigger.scoped_by == "monitors"
        assert definition.project_ids(config) == [monitored.id]
        assert not is_scheduled(config.strategy)

    def test_schedule_trigger_scopes_by_selected_projects(self) -> None:
        selected = self.create_project()
        config = Factories.create_seer_workflow_config(
            self.organization, strategy=SeerWorkflowStrategy.AGENTIC_TRIAGE_V2
        )
        Factories.create_seer_workflow_config_project(config, selected)

        definition = get_definition(config.strategy)

        assert definition.trigger.scoped_by == "projects"
        assert definition.project_ids(config) == [selected.id]
        assert is_scheduled(config.strategy)

    def test_legacy_strategies_have_no_definition(self) -> None:
        assert find_definition(SeerWorkflowStrategy.AGENTIC_TRIAGE) is None
        assert not is_scheduled(SeerWorkflowStrategy.AGENTIC_TRIAGE)
