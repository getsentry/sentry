from sentry.api.serializers import serialize
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.models.alert_rule import AlertRuleStatus, AlertRuleThresholdType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)


@freeze_time("2018-12-11 03:21:34")
class TestDetectorSerializer(TestCase):
    def setUp(self) -> None:
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        _, _, _, self.detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        self.critical_detector_trigger, _ = migrate_metric_data_conditions(self.critical_trigger)
        self.warning_detector_trigger, _ = migrate_metric_data_conditions(self.warning_trigger)
        self.critical_action, _, _ = migrate_metric_action(self.critical_trigger_action)
        self.warning_action, _, _ = migrate_metric_action(self.warning_trigger_action)
        self.resolve_trigger_data_condition = migrate_resolve_threshold_data_condition(
            self.alert_rule
        )
        self.expected_actions = [
            {
                "id": str(self.critical_trigger_action.id),
                "alertRuleTriggerId": str(self.critical_trigger.id),
                "type": "email",
                "targetType": "user",
                "targetIdentifier": str(self.user.id),
                "inputChannelId": None,
                "integrationId": None,
                "sentryAppId": None,
                "dateCreated": self.critical_trigger_action.date_added,
                "desc": f"Send a notification to {self.user.email}",
                "priority": self.critical_action.data.get("priority"),
            },
        ]
        self.expected_trigger = {
            "id": str(self.critical_trigger.id),
            "alertRuleId": str(self.alert_rule.id),
            "label": "critical",
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "alertThreshold": self.critical_detector_trigger.comparison,
            "resolveThreshold": AlertRuleThresholdType.BELOW,
            "dateCreated": self.critical_trigger.date_added,
            "actions": self.expected_actions,
        }

        self.expected = {
            "id": str(self.alert_rule.id),
            "name": self.detector.name,
            "organizationId": self.detector.project.organization_id,
            "status": AlertRuleStatus.PENDING.value,
            "query": "test",  # TODO get these all from get attrs
            "aggregate": "test",
            "timeWindow": 1,
            "resolution": 1,
            "thresholdPeriod": 1,
            "triggers": self.expected_trigger,
            "projects": [self.detector.project],  # this might be formatted incorrectly
            "owner": self.detector.owner_user_id,
            "dateModified": self.detector.date_updated,
            "dateCreated": self.detector.date_added,
            "createdBy": self.detector.created_by_id,
            "description": self.detector.description,
            "detectionType": self.detector.type,
        }

    def test_simple(self) -> None:
        serialized_detector = serialize(
            self.detector, self.user, WorkflowEngineDetectorSerializer()
        )
        assert serialized_detector == self.expected
