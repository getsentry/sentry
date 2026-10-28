from typing import Any

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleStatus,
    AlertRuleThresholdType,
)
from sentry.issues.priority import PriorityChangeReason
from sentry.models.activity import Activity
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.snuba.models import SnubaQuery
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import (
    Action,
    DataCondition,
    DataConditionGroup,
    Detector,
    Workflow,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.workflow_action_group_status import WorkflowActionGroupStatus
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class MetricSerializerTestCase(BaseWorkflowTest):
    def create_metric_detector(self, **config: Any) -> tuple[Detector, Workflow, SnubaQuery]:
        detector = self.create_detector(
            project=self.project,
            type=MetricIssue.slug,
            workflow_condition_group=self.create_data_condition_group(
                organization=self.organization
            ),
            config={
                "detection_type": AlertRuleDetectionType.STATIC,
                "comparison_delta": None,
                **config,
            },
        )
        query = self.create_snuba_query(query="level:error")
        subscription = self.create_snuba_query_subscription(snuba_query_id=query.id)
        source = self.create_data_source(
            organization=self.organization, source_id=str(subscription.id)
        )
        self.create_data_source_detector(data_source=source, detector=detector)
        workflow = self.create_workflow(organization=self.organization)
        self.create_detector_workflow(detector=detector, workflow=workflow)
        return detector, workflow, query

    def create_metric_trigger(
        self,
        detector: Detector,
        workflow: Workflow,
        threshold: float = 100,
        priority: DetectorPriorityLevel = DetectorPriorityLevel.HIGH,
    ) -> tuple[DataCondition, DataConditionGroup]:
        condition = self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            type=Condition.GREATER,
            comparison=threshold,
            condition_result=priority,
        )
        action_group = self.create_data_condition_group(organization=self.organization)
        self.create_workflow_data_condition_group(workflow=workflow, condition_group=action_group)
        self.create_data_condition(
            condition_group=action_group,
            type=Condition.ISSUE_PRIORITY_GREATER_OR_EQUAL,
            comparison=priority,
            condition_result=True,
        )
        self.create_data_condition(
            condition_group=action_group,
            type=Condition.ISSUE_PRIORITY_DEESCALATING,
            comparison=priority,
            condition_result=True,
        )
        return condition, action_group

    def create_email_action(self, condition_group: DataConditionGroup, **config: Any) -> Action:
        action = self.create_action(
            type=Action.Type.EMAIL,
            config={
                "target_type": ActionTarget.USER,
                "target_identifier": str(self.user.id),
                "target_display": None,
                **config,
            },
        )
        self.create_data_condition_group_action(action=action, condition_group=condition_group)
        return action


@freeze_time("2024-12-11 03:21:34")
class TestWorkflowEngineSerializer(MetricSerializerTestCase):
    # These historical IDs deliberately differ from the modern objects' IDs.
    legacy_rule_id = 12301
    legacy_critical_trigger_id = 12302
    legacy_critical_action_id = 12303
    legacy_warning_trigger_id = 12304
    legacy_warning_action_id = 12305

    def setUp(self) -> None:
        super().setUp()
        # Keep Action and DataConditionGroupAction IDs distinct.
        self.create_action().delete()
        self.group = self.create_group(type=MetricIssue.type_id)
        self.now = timezone.now()
        self.detector, self.workflow, self.snuba_query = self.create_metric_detector()
        self.critical_detector_trigger, self.critical_action_group = self.create_metric_trigger(
            self.detector, self.workflow
        )
        self.critical_action = self.create_email_action(self.critical_action_group)
        self.resolve_trigger_data_condition = self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            type=Condition.LESS_OR_EQUAL,
            comparison=100,
            condition_result=DetectorPriorityLevel.OK,
        )
        # This suite exercises the legacy payload contract using modern objects only.
        self.create_alert_rule_detector(alert_rule_id=self.legacy_rule_id, detector=self.detector)
        self.create_data_condition_alert_rule_trigger(
            data_condition=self.critical_detector_trigger,
            alert_rule_trigger_id=self.legacy_critical_trigger_id,
        )
        self.create_action_alert_rule_trigger_action(
            action=self.critical_action, alert_rule_trigger_action_id=self.legacy_critical_action_id
        )
        self.create_detector_group(detector=self.detector, group=self.group)
        self.expected_critical_action: list[dict[str, Any]] = [
            {
                "id": str(self.legacy_critical_action_id),
                "alertRuleTriggerId": str(self.legacy_critical_trigger_id),
                "type": "email",
                "targetType": "user",
                "targetIdentifier": str(self.user.id),
                "inputChannelId": None,
                "integrationId": None,
                "sentryAppId": None,
                "dateCreated": self.critical_action.date_added,
                "desc": f"Send a notification to {self.user.email}",
                "priority": None,
            }
        ]
        self.expected_triggers: list[dict[str, Any]] = [
            {
                "id": str(self.legacy_critical_trigger_id),
                "alertRuleId": str(self.legacy_rule_id),
                "label": "critical",
                "thresholdType": AlertRuleThresholdType.ABOVE.value,
                "alertThreshold": 100,
                "resolveThreshold": 100,
                "dateCreated": self.critical_detector_trigger.date_added,
                "actions": self.expected_critical_action,
            }
        ]
        self.expected: dict[str, Any] = {
            "id": str(self.legacy_rule_id),
            "name": self.detector.name,
            "organizationId": str(self.organization.id),
            "status": AlertRuleStatus.PENDING.value,
            "queryType": self.snuba_query.type,
            "dataset": self.snuba_query.dataset,
            "query": self.snuba_query.query,
            "aggregate": self.snuba_query.aggregate,
            "thresholdType": AlertRuleThresholdType.ABOVE.value,
            "resolveThreshold": 100,
            "timeWindow": self.snuba_query.time_window / 60,
            "environment": None,
            "resolution": self.snuba_query.resolution / 60,
            "thresholdPeriod": 1,
            "triggers": self.expected_triggers,
            "projects": [self.project.slug],
            "owner": None,
            "originalAlertRuleId": None,
            "comparisonDelta": None,
            "dateModified": self.detector.date_updated,
            "dateCreated": self.detector.date_added,
            "createdBy": None,
            "description": "",
            "sensitivity": None,
            "seasonality": None,
            "detectionType": AlertRuleDetectionType.STATIC,
            "extrapolationMode": "unknown",
        }

    def add_warning_trigger(self) -> None:
        self.warning_detector_trigger, self.warning_action_group = self.create_metric_trigger(
            self.detector,
            self.workflow,
            threshold=50,
            priority=DetectorPriorityLevel.MEDIUM,
        )
        self.warning_action = self.create_email_action(self.warning_action_group)
        self.create_data_condition_alert_rule_trigger(
            data_condition=self.warning_detector_trigger,
            alert_rule_trigger_id=self.legacy_warning_trigger_id,
        )
        self.create_action_alert_rule_trigger_action(
            action=self.warning_action, alert_rule_trigger_action_id=self.legacy_warning_action_id
        )
        self.expected_warning_action: list[dict[str, Any]] = [
            {
                **self.expected_critical_action[0],
                "id": str(self.legacy_warning_action_id),
                "alertRuleTriggerId": str(self.legacy_warning_trigger_id),
                "dateCreated": self.warning_action.date_added,
            }
        ]
        self.expected_warning_trigger: dict[str, Any] = {
            **self.expected_triggers[0],
            "id": str(self.legacy_warning_trigger_id),
            "label": "warning",
            "alertThreshold": 50,
            "resolveThreshold": 50,
            "dateCreated": self.warning_detector_trigger.date_added,
            "actions": self.expected_warning_action,
        }
        self.expected_triggers[0]["resolveThreshold"] = 50
        self.expected_triggers.append(self.expected_warning_trigger)
        self.expected["resolveThreshold"] = 50
        self.resolve_trigger_data_condition.update(comparison=50)

    def add_incident_data(self) -> None:
        self.group.update(priority=PriorityLevel.HIGH)
        WorkflowActionGroupStatus.objects.create(
            action=self.critical_action, group=self.group, workflow=self.workflow
        )
        self.group_open_period = GroupOpenPeriod.objects.get(group=self.group, project=self.project)
        self.group_open_period.update(date_started=self.now)
        self.incident_group_open_period = self.create_incident_group_open_period(
            group_open_period=self.group_open_period,
            incident_id=12401,
            incident_identifier=12402,
        )
        Activity.objects.create_group_activity(
            group=self.group,
            type=ActivityType.SET_PRIORITY,
            data={
                "priority": PriorityLevel.MEDIUM.to_str(),
                "reason": PriorityChangeReason.ONGOING,
            },
        )
