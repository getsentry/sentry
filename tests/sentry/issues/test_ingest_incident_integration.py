from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.event_manager import GroupInfo
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.issues.ongoing import bulk_transition_group_to_ongoing
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from sentry.workflow_engine.types import DetectorPriorityLevel


class IncidentGroupOpenPeriodIntegrationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="Test Alert Rule",
        )
        self.detector = self.create_detector(
            project=self.project,
            name="Test Detector",
        )
        self.alert_rule_detector = self.create_alert_rule_detector(
            alert_rule_id=self.alert_rule.id,
            detector=self.detector,
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
                project=self.detector.linked_project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )

            self.mock_status_change_message: StatusChangeMessageData = {
                "id": "1",
                "fingerprint": ["test-fingerprint"],
                "project_id": self.project.id,
                "new_status": GroupStatus.RESOLVED,
                "new_substatus": None,
                "detector_id": self.detector.id,
                "activity_data": {"test": "test"},
            }

    def save_issue_occurrence(
        self,
        group_type: int = MetricIssue.type_id,
        priority: int = DetectorPriorityLevel.HIGH,
        fingerprint: str = "test-fingerprint",
    ) -> tuple[IssueOccurrence, GroupInfo]:
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data: IssueOccurrenceData = {
            "id": "1",
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": [fingerprint],
            "issue_title": "Test Issue",
            "subtitle": "Test Subtitle",
            "resource_id": None,
            "evidence_data": {
                "detector_id": self.detector.id,
                "data_packet_source_id": str(self.query_subscription.id),
            },
            "evidence_display": [
                {"name": "Test Evidence", "value": "Test Value", "important": True}
            ],
            "type": group_type,
            "detection_time": timezone.now().timestamp(),
            "level": "error",
            "culprit": "test-culprit",
            "priority": priority,
        }

        with patch("sentry.issues.ingest.eventstream") as _:
            occurrence, group_info = save_issue_occurrence(occurrence_data, event)

        assert group_info is not None
        assert group_info.group.type == group_type
        return occurrence, group_info

    def test_ingestion_preserves_open_period_without_legacy_incident(self) -> None:
        _, group_info = self.save_issue_occurrence()
        open_period = GroupOpenPeriod.objects.get(group=group_info.group)
        assert open_period.date_ended is None
        assert not IncidentGroupOpenPeriod.objects.exists()

    def test_modern_detector_without_legacy_rule(self) -> None:
        self.alert_rule_detector.delete()
        self.alert_rule.delete()
        _, group_info = self.save_issue_occurrence()
        assert GroupOpenPeriod.objects.filter(group=group_info.group).exists()
        assert not IncidentGroupOpenPeriod.objects.exists()

    def test_non_metric_issue(self) -> None:
        _, group_info = self.save_issue_occurrence(group_type=FeedbackGroup.type_id)
        assert GroupOpenPeriod.objects.filter(group=group_info.group).exists()
        assert not IncidentGroupOpenPeriod.objects.exists()

    def test_priority_and_resolution_preserve_historical_mapping(self) -> None:
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        open_period = GroupOpenPeriod.objects.get(group=group)
        mapping = self.create_incident_group_open_period(
            incident_id=123,
            incident_identifier=42,
            group_open_period=open_period,
        )

        self.save_issue_occurrence(priority=DetectorPriorityLevel.MEDIUM)
        group.refresh_from_db()
        assert group.priority == PriorityLevel.MEDIUM
        assert GroupOpenPeriodActivity.objects.filter(
            group_open_period=open_period,
            type=OpenPeriodActivityType.STATUS_CHANGE,
            value=PriorityLevel.MEDIUM,
        ).exists()
        with self.tasks():
            update_status(group, self.mock_status_change_message)
        open_period.refresh_from_db()
        group.refresh_from_db()
        mapping.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        assert open_period.date_ended is not None
        assert mapping.incident_id == 123
        assert mapping.incident_identifier == 42

    def test_resolving_unmapped_period_preserves_open_period(self) -> None:
        _, group_info = self.save_issue_occurrence()
        with self.tasks():
            update_status(group_info.group, self.mock_status_change_message)
        open_period = GroupOpenPeriod.objects.get(group=group_info.group)
        assert open_period.date_ended is not None
        assert not IncidentGroupOpenPeriod.objects.exists()

    def test_ongoing_transition_preserves_open_period(self) -> None:
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        open_period = GroupOpenPeriod.objects.get(group=group)
        group.update(substatus=GroupSubStatus.NEW)
        bulk_transition_group_to_ongoing(GroupStatus.UNRESOLVED, GroupSubStatus.NEW, [group.id])
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        open_period.refresh_from_db()
        assert open_period.date_ended is None
        assert not IncidentGroupOpenPeriod.objects.exists()

    def test_resolve_previous_activation_after_next_activation_opened(self) -> None:
        self.assert_overlapping_activations_resolve_independently(resolve_first=True)

    def test_resolve_next_activation_while_previous_activation_still_open(self) -> None:
        self.assert_overlapping_activations_resolve_independently(resolve_first=False)

    def assert_overlapping_activations_resolve_independently(self, resolve_first: bool) -> None:
        _, first = self.save_issue_occurrence(fingerprint="activation-1")
        _, second = self.save_issue_occurrence(fingerprint="activation-2")
        resolved, active = (
            (first.group, second.group) if resolve_first else (second.group, first.group)
        )

        with self.tasks():
            update_status(resolved, self.mock_status_change_message)

        resolved.refresh_from_db()
        active.refresh_from_db()
        assert resolved.status == GroupStatus.RESOLVED
        assert GroupOpenPeriod.objects.get(group=resolved).date_ended is not None
        assert active.status == GroupStatus.UNRESOLVED
        assert GroupOpenPeriod.objects.get(group=active).date_ended is None
        assert not IncidentGroupOpenPeriod.objects.exists()
