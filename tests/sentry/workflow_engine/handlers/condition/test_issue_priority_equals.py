from sentry.types.group import PriorityLevel
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_data_conditions,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssuePriorityCondition(ConditionTestCase):
    condition = Condition.ISSUE_PRIORITY_EQUALS

    def setUp(self):
        super().setUp()
        self.job = WorkflowJob({"event": self.group_event})
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        migrate_alert_rule(self.metric_alert, self.rpc_user)

    def test_simple(self):
        _, data_condition_warning, _ = migrate_metric_data_conditions(
            self.alert_rule_trigger_warning
        )
        _, data_condition_critical, _ = migrate_metric_data_conditions(
            self.alert_rule_trigger_critical
        )

        self.group.update(priority=PriorityLevel.MEDIUM)
        self.assert_passes(data_condition_warning, self.job)
        self.assert_does_not_pass(data_condition_critical, self.job)

        self.group.update(priority=PriorityLevel.HIGH)
        self.assert_passes(data_condition_critical, self.job)
        self.assert_does_not_pass(data_condition_warning, self.job)
