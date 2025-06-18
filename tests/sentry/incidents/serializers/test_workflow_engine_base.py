from django.utils import timezone

from sentry.incidents.models.alert_rule import AlertRuleStatus, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentTrigger, TriggerStatus
from sentry.issues.priority import PriorityChangeReason
from sentry.models.activity import Activity
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import assume_test_silo_mode
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.migration_helpers.alert_rule import (
    migrate_alert_rule,
    migrate_metric_action,
    migrate_metric_data_conditions,
    migrate_resolve_threshold_data_condition,
)
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from sentry.workflow_engine.models.workflow_action_group_status import WorkflowActionGroupStatus


@freeze_time("2024-12-11 03:21:34")
class TestWorkflowEngineSerializer(TestCase):
    @assume_test_silo_mode(SiloMode.REGION)
    def setUp(self) -> None:
        self.now = timezone.now()
        self.alert_rule = self.create_alert_rule()
        self.critical_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="critical"
        )
        self.critical_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.critical_trigger
        )
        _, _, _, self.detector, _, _, _, _ = migrate_alert_rule(self.alert_rule)
        self.critical_detector_trigger, _, _ = migrate_metric_data_conditions(self.critical_trigger)

        self.critical_action, _, _ = migrate_metric_action(self.critical_trigger_action)
        self.resolve_trigger_data_condition = migrate_resolve_threshold_data_condition(
            self.alert_rule
        )
        self.expected_critical_action = [
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
            }
        ]
        self.expected_triggers = [
            {
                "id": str(self.critical_trigger.id),
                "alertRuleId": str(self.alert_rule.id),
                "label": "critical",
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
                "alertThreshold": self.critical_detector_trigger.comparison,
                "resolveThreshold": AlertRuleThresholdType.BELOW.value,
                "dateCreated": self.critical_trigger.date_added,
                "actions": self.expected_critical_action,
            },
        ]

        self.expected = {
            "id": str(self.alert_rule.id),
            "name": self.detector.name,
            "organizationId": self.detector.project.organization_id,
            "status": AlertRuleStatus.PENDING.value,
            "query": self.alert_rule.snuba_query.query,
            "aggregate": self.alert_rule.snuba_query.aggregate,
            "timeWindow": self.alert_rule.snuba_query.time_window,
            "resolution": self.alert_rule.snuba_query.resolution,
            "thresholdPeriod": self.detector.config.get("thresholdPeriod"),
            "triggers": self.expected_triggers,
            "projects": [self.project.slug],
            "owner": self.detector.owner_user_id,
            "dateModified": self.detector.date_updated,
            "dateCreated": self.detector.date_added,
            "createdBy": {},
            "description": self.detector.description or "",
            "detectionType": self.detector.type,
        }

    def add_warning_trigger(self) -> None:
        self.warning_trigger = self.create_alert_rule_trigger(
            alert_rule=self.alert_rule, label="warning"
        )
        self.warning_trigger_action = self.create_alert_rule_trigger_action(
            alert_rule_trigger=self.warning_trigger
        )
        self.warning_detector_trigger, _, _ = migrate_metric_data_conditions(self.warning_trigger)
        self.warning_action, _, _ = migrate_metric_action(self.warning_trigger_action)
        self.expected_warning_action = [
            {
                "id": str(self.warning_trigger_action.id),
                "alertRuleTriggerId": str(self.warning_trigger.id),
                "type": "email",
                "targetType": "user",
                "targetIdentifier": str(self.user.id),
                "inputChannelId": None,
                "integrationId": None,
                "sentryAppId": None,
                "dateCreated": self.warning_trigger_action.date_added,
                "desc": f"Send a notification to {self.user.email}",
                "priority": self.warning_action.data.get("priority"),
            }
        ]
        self.expected_warning_trigger = {
            "id": str(self.warning_trigger.id),
            "alertRuleId": str(self.alert_rule.id),
            "label": "warning",
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "alertThreshold": self.critical_detector_trigger.comparison,
            "resolveThreshold": AlertRuleThresholdType.BELOW.value,
            "dateCreated": self.critical_trigger.date_added,
            "actions": self.expected_warning_action,
        }
        self.expected_triggers.append(self.expected_warning_trigger)

    def add_incident_data(self) -> None:
        self.incident = self.create_incident(alert_rule=self.alert_rule, date_started=self.now)
        IncidentTrigger.objects.create(
            incident=self.incident,
            alert_rule_trigger=self.warning_trigger,
            status=TriggerStatus.ACTIVE.value,
        )

        self.group.priority = PriorityLevel.HIGH
        self.group.save()
        workflow = self.create_workflow()
        WorkflowActionGroupStatus.objects.create(
            action=self.critical_action, group=self.group, workflow=workflow
        )
        self.group_open_period = GroupOpenPeriod.objects.get(
            group=self.group, project=self.detector.project
        )
        self.group_open_period.update(date_started=self.incident.date_started)
        self.incident_group_open_period = IncidentGroupOpenPeriod.objects.create(
            group_open_period=self.group_open_period,
            incident_id=self.incident.id,
            incident_identifier=self.incident.identifier,
        )
        Activity.objects.create_group_activity(
            group=self.group_open_period.group,
            type=ActivityType.SET_PRIORITY,
            data={
                "priority": PriorityLevel.MEDIUM.to_str(),
                "reason": PriorityChangeReason.ONGOING,
            },
        )
