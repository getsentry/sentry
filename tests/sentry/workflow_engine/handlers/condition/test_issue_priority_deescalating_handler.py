from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.types.group import PriorityLevel
from sentry.users.services.user.service import user_service
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_data_conditions,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel, WorkflowEventData
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestIssuePriorityGreaterOrEqualCondition(ConditionTestCase):
    condition = Condition.ISSUE_PRIORITY_DEESCALATING

    def setUp(self):
        super().setUp()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group_event.group)
        self.metric_alert = self.create_alert_rule()
        self.alert_rule_trigger_warning = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="warning"
        )
        self.alert_rule_trigger_critical = self.create_alert_rule_trigger(
            alert_rule=self.metric_alert, label="critical"
        )
        self.rpc_user = user_service.get_user(user_id=self.user.id)
        migrate_alert_rule(self.metric_alert, self.rpc_user)

        data_condition_warning_tuple = migrate_metric_data_conditions(
            self.alert_rule_trigger_warning
        )
        data_condition_critical_tuple = migrate_metric_data_conditions(
            self.alert_rule_trigger_critical
        )

        assert data_condition_warning_tuple is not None
        assert data_condition_critical_tuple is not None
        dc_warning = data_condition_warning_tuple[1]
        dc_critical = data_condition_critical_tuple[1]

        self.deescalating_dc_warning = self.create_data_condition(
            comparison=DetectorPriorityLevel.MEDIUM,
            type=self.condition,
            condition_result=True,
            condition_group=dc_warning.condition_group,
        )

        self.deescalating_dc_critical = self.create_data_condition(
            comparison=DetectorPriorityLevel.HIGH,
            type=self.condition,
            condition_result=True,
            condition_group=dc_critical.condition_group,
        )

    def update_group_and_open_period(self, priority: PriorityLevel) -> None:
        self.group.update(priority=priority)
        open_period = (
            GroupOpenPeriod.objects.filter(group=self.group).order_by("-date_started").first()
        )
        assert open_period is not None
        highest_seen_priority = open_period.data.get("highest_seen_priority", priority)
        open_period.data["highest_seen_priority"] = max(highest_seen_priority, priority)
        open_period.save()

    def test_warning(self):
        self.update_group_and_open_period(priority=PriorityLevel.MEDIUM)
        self.assert_does_not_pass(self.deescalating_dc_warning, self.event_data)

        self.update_group_and_open_period(priority=PriorityLevel.HIGH)
        self.assert_does_not_pass(self.deescalating_dc_warning, self.event_data)

        self.group.update(status=GroupStatus.RESOLVED)
        self.assert_passes(self.deescalating_dc_warning, self.event_data)

    def test_critical_threshold_not_breached(self):
        self.update_group_and_open_period(priority=PriorityLevel.MEDIUM)
        self.assert_does_not_pass(self.deescalating_dc_critical, self.event_data)

        self.group.update(status=GroupStatus.RESOLVED)
        self.assert_does_not_pass(self.deescalating_dc_critical, self.event_data)

    def test_critical(self):
        self.update_group_and_open_period(priority=PriorityLevel.MEDIUM)
        self.assert_does_not_pass(self.deescalating_dc_critical, self.event_data)

        self.update_group_and_open_period(priority=PriorityLevel.HIGH)
        self.assert_does_not_pass(self.deescalating_dc_critical, self.event_data)

        self.update_group_and_open_period(priority=PriorityLevel.MEDIUM)
        self.assert_passes(self.deescalating_dc_critical, self.event_data)

        self.group.update(status=GroupStatus.RESOLVED)
        self.assert_passes(self.deescalating_dc_critical, self.event_data)
