from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import (
    Action,
    AlertRuleWorkflow,
    DataCondition,
    DataConditionGroup,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition


class TestMigrateIssueAlerts(TestMigrations):
    migrate_from = "0048_fix_some_drift"
    migrate_to = "0049_remove_orphaned_rule_workflows"
    app = "workflow_engine"

    def setup_initial_state(self):
        trigger_conditions = self.create_data_condition_group()
        self.create_data_condition(
            type=Condition.REGRESSION_EVENT,
            comparison=True,
            condition_result=True,
            condition_group=trigger_conditions,
        )
        self.orphaned_workflow = self.create_workflow(when_condition_group=trigger_conditions)

        filter_conditions = self.create_data_condition_group()
        self.create_data_condition(
            type=Condition.EVENT_ATTRIBUTE,
            comparison={"attribute": "platform", "value": "python", "match": "eq"},
            condition_result=True,
            condition_group=filter_conditions,
        )
        self.create_workflow_data_condition_group(self.orphaned_workflow, filter_conditions)
        action = self.create_action()
        self.create_data_condition_group_action(action=action, condition_group=filter_conditions)

        self.orphaned_workflow_lookup = AlertRuleWorkflow.objects.create(
            workflow_id=self.orphaned_workflow.id, rule_id=123
        )

        self.metric_workflow = self.create_workflow()
        self.metric_detector = self.create_detector(type="metric_issue")
        self.create_detector_workflow(self.metric_detector, self.metric_workflow)
        AlertRuleWorkflow.objects.create(workflow_id=self.metric_workflow.id, alert_rule_id=321)

    def test(self):
        assert not Workflow.objects.filter(id=self.orphaned_workflow.id).exists()
        assert not AlertRuleWorkflow.objects.filter(rule_id=self.orphaned_workflow.id).exists()

        # only orphaned workflow had actions, DCGs, and DCs
        assert Action.objects.all().count() == 0
        assert DataConditionGroup.objects.all().count() == 0
        assert DataCondition.objects.all().count() == 0

        self.metric_workflow.refresh_from_db()
        assert self.metric_workflow
