from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.rule import Rule
from sentry.rules.conditions.reappeared_event import ReappearedEventCondition
from sentry.rules.conditions.regression_event import RegressionEventCondition
from sentry.rules.filters.age_comparison import AgeComparisonFilter
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import install_slack
from sentry.workflow_engine.handlers.condition.utils.age import AgeComparisonType
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
    WorkflowDataConditionGroup,
)


class IssueAlertDeletionTest(TestCase):
    def setUp(self) -> None:
        integration = install_slack(self.organization)
        self.issue_alert = self.create_project_rule(
            name="test",
            condition_data=[
                {"id": ReappearedEventCondition.id},
                {"id": RegressionEventCondition.id},
                {
                    "id": AgeComparisonFilter.id,
                    "comparison_type": AgeComparisonType.OLDER,
                    "value": "10",
                    "time": "hour",
                },
            ],
            action_match="any",
            filter_match="any",
            action_data=[
                {
                    "channel": "#my-channel",
                    "id": "sentry.integrations.slack.notify_action.SlackNotifyServiceAction",
                    "workspace": str(integration.id),
                    "uuid": "test-uuid",
                    "channel_id": "C01234567890",
                },
            ],
            frequency=5,
        )

        alert_rule_workflow = AlertRuleWorkflow.objects.get(rule_id=self.issue_alert.id)
        self.workflow = alert_rule_workflow.workflow
        when_dcg = self.workflow.when_condition_group
        if_dcg = WorkflowDataConditionGroup.objects.get(workflow=self.workflow).condition_group

        assert when_dcg is not None
        assert if_dcg is not None

        self.when_dcg: DataConditionGroup = when_dcg
        self.if_dcg: DataConditionGroup = if_dcg

    def assert_rule_deleted_workflow_survives(self, workflow: Workflow) -> None:
        assert not Rule.objects.filter(id=self.issue_alert.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=self.issue_alert.id).exists()
        assert Workflow.objects.filter(id=workflow.id).exists()

    def assert_everything_deleted(
        self, workflow: Workflow, when_dcg: DataConditionGroup, if_dcg: DataConditionGroup
    ) -> None:
        assert not AlertRuleWorkflow.objects.filter(rule_id=self.issue_alert.id).exists()
        assert not Workflow.objects.filter(id=workflow.id).exists()
        assert not DataConditionGroup.objects.filter(id=when_dcg.id).exists()
        assert not DataConditionGroup.objects.filter(id=if_dcg.id).exists()
        assert not DataCondition.objects.filter(condition_group=when_dcg).exists()
        assert not DataCondition.objects.filter(condition_group=if_dcg).exists()
        assert not DataConditionGroupAction.objects.filter(condition_group=if_dcg).exists()
        assert not Action.objects.all().exists()

    def test_delete_issue_alert__rule_deletion_task(self) -> None:
        self.issue_alert.update(status=ObjectStatus.PENDING_DELETION)
        CellScheduledDeletion.schedule(self.issue_alert, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_rule_deleted_workflow_survives(self.workflow)

    def test_delete_issue_alert__project_deletion_task(self) -> None:
        self.project.update(status=ObjectStatus.PENDING_DELETION)
        CellScheduledDeletion.schedule(self.project, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Workflows are organization-scoped and survive project deletion.
        self.assert_rule_deleted_workflow_survives(self.workflow)

    def test_delete_issue_alert__org_deletion_task(self) -> None:
        self.organization.update(status=ObjectStatus.PENDING_DELETION)
        CellScheduledDeletion.schedule(self.organization, days=0)

        with self.tasks():
            run_scheduled_deletions()

        self.assert_everything_deleted(self.workflow, self.when_dcg, self.if_dcg)
