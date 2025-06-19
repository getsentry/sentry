import uuid
from collections.abc import Mapping
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue, MetricIssueEvidenceData
from sentry.incidents.models.alert_rule import (
    AlertRuleDetectionType,
    AlertRuleSensitivity,
    AlertRuleThresholdType,
)
from sentry.incidents.models.incident import IncidentStatus, TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import Action, Condition
from sentry.workflow_engine.types import DetectorPriorityLevel, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

pytestmark = [requires_snuba]


class TestHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        trigger_status: TriggerStatus,
        notification_uuid: str,
        organization: Organization,
        project: Project,
    ) -> None:
        pass


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class MetricAlertHandlerBase(BaseWorkflowTest):
    def create_models(self):
        self.project = self.create_project()
        self.detector = self.create_detector(
            project=self.project,
            config={"detection_type": "static", "threshold_period": 1},
            type="metric_issue",
        )

        with self.tasks():
            self.snuba_query = create_snuba_query(
                query_type=SnubaQuery.Type.ERROR,
                dataset=Dataset.Events,
                query="hello",
                aggregate="count()",
                time_window=timedelta(minutes=1),
                resolution=timedelta(minutes=1),
                environment=self.environment,
                event_types=[SnubaQueryEventType.EventType.ERROR],
            )
            self.query_subscription = create_snuba_subscription(
                project=self.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )
        self.data_source = self.create_data_source(
            organization=self.organization, source_id=self.query_subscription.id
        )
        self.create_data_source_detector(data_source=self.data_source, detector=self.detector)
        self.workflow = self.create_workflow(environment=self.environment)

        self.snuba_query = self.create_snuba_query()

        self.alert_rule = self.create_alert_rule()
        self.create_alert_rule_detector(detector=self.detector, alert_rule_id=self.alert_rule.id)

        self.subscription = self.create_snuba_query_subscription(snuba_query_id=self.snuba_query.id)

        self.data_source = self.create_data_source(
            organization=self.organization,
            source_id=self.subscription.id,
        )

        self.evidence_data = MetricIssueEvidenceData(
            value=123.45,
            detector_id=self.detector.id,
            data_packet_source_id=int(self.data_source.source_id),
            conditions=[
                {
                    "id": 1,
                    "type": Condition.GREATER_OR_EQUAL,
                    "comparison": 123,
                    "condition_result": DetectorPriorityLevel.HIGH.value,
                },
                {
                    "id": 2,
                    "type": Condition.GREATER_OR_EQUAL,
                    "comparison": 100,
                    "condition_result": DetectorPriorityLevel.MEDIUM.value,
                },
            ],
            alert_id=self.alert_rule.id,
        )
        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data=asdict(self.evidence_data),
            ),
        )

        self.group.priority = PriorityLevel.HIGH.value
        self.group.save()
        self.open_period, _ = GroupOpenPeriod.objects.get_or_create(
            group=self.group,
            project=self.project,
            date_started=self.group_event.group.first_seen,
        )
        self.event_data = WorkflowEventData(
            event=self.group_event, workflow_env=self.workflow.environment
        )

    def setUp(self):
        self.create_models()

    def create_issue_occurrence(
        self,
        priority: int | None = None,
        level: str = "error",
        evidence_data: Mapping[str, Any] | None = None,
    ):
        if evidence_data is None:
            evidence_data = {}

        return IssueOccurrence(
            id=str(uuid.uuid4()),
            project_id=self.project.id,
            event_id=str(uuid.uuid4()),
            fingerprint=["test_fingerprint"],
            issue_title="test_issue_title",
            subtitle="test_subtitle",
            resource_id="test_resource_id",
            evidence_data=evidence_data,
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level=level,
            culprit="test_culprit",
            priority=priority,
            assignee=None,
        )

    def assert_notification_context(
        self,
        notification_context: NotificationContext,
        integration_id: int | None = None,
        target_identifier: str | None = None,
        target_display: str | None = None,
        sentry_app_config: list[dict[str, Any]] | dict[str, Any] | None = None,
        sentry_app_id: str | None = None,
        target_type: ActionTarget | None = None,
    ):
        assert asdict(notification_context) == {
            "id": notification_context.id,
            "integration_id": integration_id,
            "target_identifier": target_identifier,
            "target_display": target_display,
            "sentry_app_config": sentry_app_config,
            "sentry_app_id": sentry_app_id,
            "target_type": target_type,
        }

    def assert_alert_context(
        self,
        alert_context: AlertContext,
        name: str,
        action_identifier_id: int,
        threshold_type: AlertRuleThresholdType | None = None,
        detection_type: AlertRuleDetectionType | None = None,
        comparison_delta: int | None = None,
        sensitivity: AlertRuleSensitivity | None = None,
        resolve_threshold: float | None = None,
        alert_threshold: float | None = None,
    ):
        assert asdict(alert_context) == {
            "name": name,
            "action_identifier_id": action_identifier_id,
            "threshold_type": threshold_type,
            "detection_type": detection_type,
            "comparison_delta": comparison_delta,
            "sensitivity": sensitivity,
            "resolve_threshold": resolve_threshold,
            "alert_threshold": alert_threshold,
        }

    def assert_metric_issue_context(
        self,
        metric_issue_context: MetricIssueContext,
        open_period_identifier: int,
        snuba_query: SnubaQuery,
        new_status: IncidentStatus,
        title: str,
        metric_value: float | None = None,
        subscription: QuerySubscription | None = None,
        group: Group | None = None,
    ):
        assert asdict(metric_issue_context) == {
            "id": metric_issue_context.id,
            "open_period_identifier": open_period_identifier,
            "snuba_query": snuba_query,
            "subscription": subscription,
            "new_status": new_status,
            "metric_value": metric_value,
            "title": title,
            "group": group,
        }

    def assert_open_period_context(
        self,
        open_period_context: OpenPeriodContext,
        id: int,
        date_started: datetime,
        date_closed: datetime | None,
    ):
        assert asdict(open_period_context) == {
            "id": id,
            "date_started": date_started,
            "date_closed": date_closed,
        }

    def unpack_kwargs(self, mock_send_alert):
        _, kwargs = mock_send_alert.call_args
        notification_context = kwargs["notification_context"]
        alert_context = kwargs["alert_context"]
        metric_issue_context = kwargs["metric_issue_context"]
        open_period_context = kwargs["open_period_context"]
        organization = kwargs["organization"]
        notification_uuid = kwargs["notification_uuid"]
        return (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        )


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class TestBaseMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self):
        super().setUp()
        self.action = self.create_action(
            type=Action.Type.DISCORD,
            integration_id="1234567890",
            config={"target_identifier": "channel456", "target_type": ActionTarget.SPECIFIC},
            data={"tags": "environment,user,my_tag"},
        )
        self.handler = TestHandler()

    def test_missing_occurrence_raises_value_error(self):
        self.event_data.event._occurrence = None

        with pytest.raises(ValueError):
            self.handler.invoke_legacy_registry(self.event_data, self.action, self.detector)

    def test_get_incident_status(self):
        # Initial priority is high -> incident is critical
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id,
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.HIGH.value,
                level="error",
            ),
        )
        assert group_event.occurrence is not None
        assert group_event.occurrence.priority is not None
        assert (
            MetricIssueContext._get_new_status(
                group, PriorityLevel(group_event.occurrence.priority)
            )
            == IncidentStatus.CRITICAL
        )

        # Initial priority is medium -> incident is warning
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id,
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.MEDIUM.value,
                level="warning",
            ),
        )
        assert group_event.occurrence is not None
        assert group_event.occurrence.priority is not None
        assert (
            MetricIssueContext._get_new_status(
                group, PriorityLevel(group_event.occurrence.priority)
            )
            == IncidentStatus.WARNING
        )

        # Resolved group -> incident is closed
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id,
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.MEDIUM.value,
                level="warning",
            ),
        )
        assert group_event.occurrence is not None
        assert group_event.occurrence.priority is not None
        # Set the group to resolved -> incident is closed
        group.status = GroupStatus.RESOLVED
        assert (
            MetricIssueContext._get_new_status(
                group, PriorityLevel(group_event.occurrence.priority)
            )
            == IncidentStatus.CLOSED
        )

    def test_build_notification_context(self):
        notification_context = self.handler.build_notification_context(self.action)
        assert isinstance(notification_context, NotificationContext)
        assert notification_context.target_identifier == "channel456"
        assert notification_context.integration_id == "1234567890"
        assert notification_context.sentry_app_config is None

    def test_build_alert_context(self):
        assert self.group_event.occurrence is not None
        alert_context = self.handler.build_alert_context(
            self.detector,
            self.evidence_data,
            self.group_event.group.status,
            self.group_event.occurrence.priority,
        )
        assert isinstance(alert_context, AlertContext)
        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type == AlertRuleThresholdType.ABOVE
        assert alert_context.comparison_delta is None

    def test_get_new_status(self):
        assert self.group_event.occurrence is not None
        assert self.group_event.occurrence.priority is not None
        status = MetricIssueContext._get_new_status(
            self.group_event.group, PriorityLevel(self.group_event.occurrence.priority)
        )
        assert status == IncidentStatus.CRITICAL

        _, _, group_event = self.create_group_event(
            group_type_id=MetricIssue.type_id,
            occurrence=self.create_issue_occurrence(
                priority=PriorityLevel.MEDIUM.value,
                level="warning",
                evidence_data={"snuba_query_id": self.snuba_query.id},
            ),
        )
        assert group_event.occurrence is not None
        assert group_event.occurrence.priority is not None
        status = MetricIssueContext._get_new_status(
            group_event.group, PriorityLevel(group_event.occurrence.priority)
        )
        assert status == IncidentStatus.WARNING

    @mock.patch.object(TestHandler, "send_alert")
    def test_invoke_legacy_registry(self, mock_send_alert):
        self.handler.invoke_legacy_registry(self.event_data, self.action, self.detector)

        assert mock_send_alert.call_count == 1

        _, kwargs = mock_send_alert.call_args

        notification_context = kwargs["notification_context"]
        alert_context = kwargs["alert_context"]
        metric_issue_context = kwargs["metric_issue_context"]
        organization = kwargs["organization"]
        notification_uuid = kwargs["notification_uuid"]

        self.assert_notification_context(
            notification_context,
            integration_id=self.action.integration_id,
            target_identifier=self.action.config["target_identifier"],
            target_display=None,
            sentry_app_config=None,
            sentry_app_id=None,
        )
        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            sensitivity=None,
            resolve_threshold=None,
            alert_threshold=self.evidence_data.conditions[0]["comparison"],
        )
        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.open_period.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=self.evidence_data.value,
            title=self.group_event.group.title,
            group=self.group_event.group,
            subscription=self.subscription,
        )
        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)

    def test_send_alert_not_implemented(self):
        with pytest.raises(NotImplementedError):
            BaseMetricAlertHandler().send_alert(
                notification_context=mock.MagicMock(),
                alert_context=mock.MagicMock(),
                metric_issue_context=mock.MagicMock(),
                open_period_context=mock.MagicMock(),
                trigger_status=TriggerStatus.ACTIVE,
                organization=mock.MagicMock(),
                project=mock.MagicMock(),
                notification_uuid="test-uuid",
            )
