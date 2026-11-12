from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import CellScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.rule import Rule
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    DataConditionGroupAction,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition


class IssueAlertDeletionTest(TestCase):
    def setUp(self) -> None:
        self.issue_alert = self.create_project_rule(name="test")
        self.when_dcg = self.create_data_condition_group(
            organization=self.organization,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.create_data_condition(
            condition_group=self.when_dcg,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )
        self.workflow = self.create_workflow(
            organization=self.organization,
            name=self.issue_alert.label,
            when_condition_group=self.when_dcg,
            config={"frequency": 5},
        )
        self.create_alert_rule_workflow(rule_id=self.issue_alert.id, workflow=self.workflow)
        self.if_dcg = self.create_data_condition_group(
            organization=self.organization,
            logic_type=DataConditionGroup.Type.ANY_SHORT_CIRCUIT,
        )
        self.create_data_condition(
            condition_group=self.if_dcg,
            type=Condition.EVENT_SEEN_COUNT,
            comparison=1,
            condition_result=True,
        )
        self.create_workflow_data_condition_group(
            workflow=self.workflow,
            condition_group=self.if_dcg,
        )
        action = self.create_action()
        self.create_data_condition_group_action(condition_group=self.if_dcg, action=action)

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
