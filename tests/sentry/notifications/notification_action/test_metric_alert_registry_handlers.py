import uuid
from collections.abc import Mapping
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import Any
from unittest import mock

import pytest
from django.utils import timezone

from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
    OpenPeriodContext,
)
from sentry.issues.grouptype import MetricIssuePOC
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import Organization
from sentry.notifications.models.notificationaction import ActionTarget
from sentry.notifications.notification_action.metric_alert_registry import (
    OpsgenieMetricAlertHandler,
    PagerDutyMetricAlertHandler,
)
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestHandler(BaseMetricAlertHandler):
    @classmethod
    def send_alert(
        cls,
        notification_context: NotificationContext,
        alert_context: AlertContext,
        metric_issue_context: MetricIssueContext,
        open_period_context: OpenPeriodContext,
        organization: Organization,
        notification_uuid: str,
    ) -> None:
        pass


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class MetricAlertHandlerBase(BaseWorkflowTest):
    def setUp(self):
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow(environment=self.environment)

        self.snuba_query = self.create_snuba_query()

        self.group, self.event, self.group_event = self.create_group_event(
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data={
                    "snuba_query_id": self.snuba_query.id,
                    "metric_value": 123.45,
                },
            ),
        )

        self.save_group_with_open_period(self.group)
        self.job = WorkflowEventData(event=self.group_event, workflow_env=self.environment)

    def save_group_with_open_period(self, group: Group) -> None:
        # test a new group has an open period
        group.type = MetricIssuePOC.type_id
        group.save()
        Activity.objects.create(
            group=group,
            project=group.project,
            type=ActivityType.SET_RESOLVED.value,
            datetime=timezone.now() + timedelta(days=1),
        )

    def create_issue_occurrence(
        self,
        initial_issue_priority: int | None = None,
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
            type=MetricIssuePOC,
            detection_time=timezone.now(),
            level=level,
            culprit="test_culprit",
            initial_issue_priority=initial_issue_priority,
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
    ):
        assert asdict(notification_context) == {
            "id": notification_context.id,
            "integration_id": integration_id,
            "target_identifier": target_identifier,
            "target_display": target_display,
            "sentry_app_config": sentry_app_config,
            "sentry_app_id": sentry_app_id,
        }

    def assert_alert_context(
        self,
        alert_context: AlertContext,
        name: str,
        action_identifier_id: int,
        threshold_type: AlertRuleThresholdType | None = None,
        detection_type: AlertRuleDetectionType | None = None,
        comparison_delta: int | None = None,
    ):
        assert asdict(alert_context) == {
            "name": name,
            "action_identifier_id": action_identifier_id,
            "threshold_type": threshold_type,
            "detection_type": detection_type,
            "comparison_delta": comparison_delta,
        }

    def assert_metric_issue_context(
        self,
        metric_issue_context: MetricIssueContext,
        open_period_identifier: int,
        snuba_query: SnubaQuery,
        new_status: IncidentStatus,
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
            "group": group,
        }

    def assert_open_period_context(
        self,
        open_period_context: OpenPeriodContext,
        date_started: datetime,
        date_closed: datetime | None,
    ):
        assert asdict(open_period_context) == {
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
        self.job.event.occurrence = None

        with pytest.raises(ValueError):
            self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

    def test_get_incident_status(self):
        # Initial priority is high -> incident is critical
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.HIGH.value,
                level="error",
            ),
        )
        assert group_event.occurrence is not None
        assert (
            MetricIssueContext._get_new_status(group, group_event.occurrence)
            == IncidentStatus.CRITICAL
        )

        # Initial priority is medium -> incident is warning
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.MEDIUM.value,
                level="warning",
            ),
        )
        assert group_event.occurrence is not None
        assert (
            MetricIssueContext._get_new_status(group, group_event.occurrence)
            == IncidentStatus.WARNING
        )

        # Resolved group -> incident is closed
        group, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.MEDIUM.value,
                level="warning",
            ),
        )
        assert group_event.occurrence is not None
        # Set the group to resolved -> incident is closed
        group.status = GroupStatus.RESOLVED
        assert (
            MetricIssueContext._get_new_status(group, group_event.occurrence)
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
        alert_context = self.handler.build_alert_context(self.detector, self.group_event.occurrence)
        assert isinstance(alert_context, AlertContext)
        assert alert_context.name == self.detector.name
        assert alert_context.action_identifier_id == self.detector.id
        assert alert_context.threshold_type is None
        assert alert_context.comparison_delta is None

    def test_get_snuba_query(self):
        _, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.HIGH.value,
                level="error",
                evidence_data={"snuba_query_id": self.snuba_query.id},
            ),
        )
        assert group_event.occurrence is not None
        query = MetricIssueContext._get_snuba_query(group_event.occurrence)
        assert query == self.snuba_query

    def test_get_new_status(self):
        assert self.group_event.occurrence is not None
        status = MetricIssueContext._get_new_status(
            self.group_event.group, self.group_event.occurrence
        )
        assert status == IncidentStatus.CRITICAL

        _, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.MEDIUM.value,
                level="warning",
                evidence_data={"snuba_query_id": self.snuba_query.id},
            ),
        )
        assert group_event.occurrence is not None
        status = MetricIssueContext._get_new_status(group_event.group, group_event.occurrence)
        assert status == IncidentStatus.WARNING

    def test_get_metric_value(self):
        _, _, group_event = self.create_group_event(
            group_type_id=MetricIssuePOC.type_id,
            occurrence=self.create_issue_occurrence(
                initial_issue_priority=PriorityLevel.MEDIUM.value,
                level="warning",
                evidence_data={"metric_value": 123.45},
            ),
        )
        assert group_event.occurrence is not None
        value = MetricIssueContext._get_metric_value(group_event.occurrence)
        assert value == 123.45

    @mock.patch.object(TestHandler, "send_alert")
    def test_invoke_legacy_registry(self, mock_send_alert):
        self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

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
            threshold_type=None,
            detection_type=None,
            comparison_delta=None,
        )
        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.group_event.group.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
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
                organization=mock.MagicMock(),
                notification_uuid="test-uuid",
            )


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class TestPagerDutyMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self):
        super().setUp()
        self.action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=1234567890,
            config={"target_identifier": "service123", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "default"},
        )
        self.handler = PagerDutyMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.handlers.pagerduty_metric_alert_handler.send_incident_alert_notification"
    )
    def test_send_alert(self, mock_send_incident_alert_notification):
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector, self.group_event.occurrence
        )
        metric_issue_context = MetricIssueContext.from_group_event(self.group_event)
        open_period_context = OpenPeriodContext.from_group(self.group)
        notification_uuid = str(uuid.uuid4())

        self.handler.send_alert(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

        mock_send_incident_alert_notification.assert_called_once_with(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.PagerDutyMetricAlertHandler.send_alert"
    )
    def test_invoke_legacy_registry(self, mock_send_alert):
        self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)

        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="service123",
            target_display=None,
            sentry_app_config={"priority": "default"},
            sentry_app_id=None,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=None,
            detection_type=None,
            comparison_delta=None,
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.group_event.group.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
        )

        self.assert_open_period_context(
            open_period_context,
            date_started=self.group_event.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class TestOpsgenieMetricAlertHandler(MetricAlertHandlerBase):
    def setUp(self):
        super().setUp()
        self.action = self.create_action(
            type=Action.Type.OPSGENIE,
            integration_id=1234567890,
            config={"target_identifier": "team123", "target_type": ActionTarget.SPECIFIC},
            data={"priority": "P1"},
        )
        self.handler = OpsgenieMetricAlertHandler()

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.handlers.opsgenie_metric_alert_handler.send_incident_alert_notification"
    )
    def test_send_alert(self, mock_send_incident_alert_notification):
        notification_context = NotificationContext.from_action_model(self.action)
        assert self.group_event.occurrence is not None
        alert_context = AlertContext.from_workflow_engine_models(
            self.detector, self.group_event.occurrence
        )
        metric_issue_context = MetricIssueContext.from_group_event(self.group_event)
        open_period_context = OpenPeriodContext.from_group(self.group)
        notification_uuid = str(uuid.uuid4())

        self.handler.send_alert(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

        mock_send_incident_alert_notification.assert_called_once_with(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            organization=self.detector.project.organization,
            notification_uuid=notification_uuid,
        )

    @mock.patch(
        "sentry.notifications.notification_action.metric_alert_registry.OpsgenieMetricAlertHandler.send_alert"
    )
    def test_invoke_legacy_registry(self, mock_send_alert):
        self.handler.invoke_legacy_registry(self.job, self.action, self.detector)

        assert mock_send_alert.call_count == 1
        (
            notification_context,
            alert_context,
            metric_issue_context,
            open_period_context,
            organization,
            notification_uuid,
        ) = self.unpack_kwargs(mock_send_alert)

        assert isinstance(notification_context, NotificationContext)
        assert isinstance(alert_context, AlertContext)
        assert isinstance(metric_issue_context, MetricIssueContext)
        self.assert_notification_context(
            notification_context,
            integration_id=1234567890,
            target_identifier="team123",
            target_display=None,
            sentry_app_config={"priority": "P1"},
            sentry_app_id=None,
        )

        self.assert_alert_context(
            alert_context,
            name=self.detector.name,
            action_identifier_id=self.detector.id,
            threshold_type=None,
            detection_type=None,
            comparison_delta=None,
        )

        self.assert_metric_issue_context(
            metric_issue_context,
            open_period_identifier=self.group_event.group.id,
            snuba_query=self.snuba_query,
            new_status=IncidentStatus.CRITICAL,
            metric_value=123.45,
            group=self.group_event.group,
        )

        self.assert_open_period_context(
            open_period_context,
            date_started=self.group_event.group.first_seen,
            date_closed=None,
        )

        assert organization == self.detector.project.organization
        assert isinstance(notification_uuid, str)
