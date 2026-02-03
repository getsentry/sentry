from datetime import timedelta
from unittest import mock
from unittest.mock import patch

from django.utils import timezone

from sentry.event_manager import GroupInfo
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import Incident, IncidentActivity, IncidentStatus
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
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
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
                project=self.detector.project,
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
    ) -> tuple[IssueOccurrence, GroupInfo]:
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data: IssueOccurrenceData = {
            "id": "1",
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": ["test-fingerprint"],
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

    def test_save_issue_occurrence_creates_incident_and_relationship(self) -> None:
        """Test that save_issue_occurrence creates the relationship and incident"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group)
        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=item.incident_id)
        activity = IncidentActivity.objects.filter(incident_id=incident.id)
        assert len(activity) == 3  # detected, created, status change

    def test_save_issue_occurrence_no_relationship_for_non_metric_issues(self) -> None:
        # Test that save_issue_occurrence doesn't create relationships for non-metric issues
        _, group_info = self.save_issue_occurrence(group_type=FeedbackGroup.type_id)

        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert not IncidentGroupOpenPeriod.objects.filter(group_open_period=open_period).exists()

    def test_updating_group_priority_updates_incident(self) -> None:
        """Test that a group priority update creates an equivalent IncidentActivity entry"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        assert GroupOpenPeriod.objects.filter(group=group, project=self.project).exists()

        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)

        _, group_info = self.save_issue_occurrence(priority=DetectorPriorityLevel.MEDIUM)
        group = group_info.group
        assert group is not None

        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=item.incident_id)
        activity = IncidentActivity.objects.filter(incident_id=incident.id)

        assert len(activity) == 4
        last_activity_entry = activity[3]
        assert last_activity_entry.type == 2
        assert last_activity_entry.value == str(IncidentStatus.WARNING.value)
        assert last_activity_entry.previous_value == str(IncidentStatus.CRITICAL.value)

    def test_resolving_group_updates_incident(self) -> None:
        """Test that save_issue_occurrence creates the relationship and incident"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        with self.tasks():
            update_status(group, self.mock_status_change_message)

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert open_period.date_ended is not None
        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=item.incident_id)
        activity = IncidentActivity.objects.filter(incident_id=incident.id)
        assert len(activity) == 4  # detected, created, priority change, close

    def test_can_close_outstanding_incident(self) -> None:
        """Test that we close incidents that are left open as a result of IGOP linkage bugs"""
        four_minutes_ago = timezone.now() - timedelta(minutes=4)
        three_minutes_ago = timezone.now() - timedelta(minutes=3)
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        assert GroupOpenPeriod.objects.filter(group=group, project=self.project).exists()

        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)

        # replicate the following conditions in the DB: an open incident is tied to
        # a closed open period, and a new open period is being passed to create_from_occurrence()
        dummy_relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        dummy_open_period = GroupOpenPeriod.objects.create(
            group=group,
            date_started=four_minutes_ago,
            date_ended=three_minutes_ago,
            project=self.project,
        )
        incident = Incident.objects.get(id=dummy_relationship.incident_id)
        dummy_relationship.delete()
        IncidentGroupOpenPeriod.objects.create(
            incident_id=incident.id,
            incident_identifier=incident.identifier,
            group_open_period=dummy_open_period,
        )

        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        incident.refresh_from_db()
        assert IncidentGroupOpenPeriod.objects.count() == 2
        assert incident.date_closed is not None
        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        new_incident = Incident.objects.get(id=item.incident_id)
        activity = IncidentActivity.objects.filter(incident_id=new_incident.id)
        assert len(activity) == 3  # detected, created, status change

    def test_can_resolve_outstanding_incident(self) -> None:
        """Test that we link and update an incident that was opened before the org started single processing on resolution"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        assert GroupOpenPeriod.objects.filter(group=group, project=self.project).exists()

        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)

        dummy_relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=dummy_relationship.incident_id)

        # this is a little hacky, but to emulate dual processing -> single processing I will
        # just delete the IGOP relationship
        IncidentGroupOpenPeriod.objects.all().delete()

        with self.tasks():
            update_status(group, self.mock_status_change_message)

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert open_period.date_ended is not None
        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        assert item.incident_id == incident.id
        activity = IncidentActivity.objects.filter(incident_id=incident.id)
        assert len(activity) == 4  # detected, created, priority change, close

        last_activity_entry = activity[3]
        assert last_activity_entry.type == 2
        assert last_activity_entry.previous_value == str(IncidentStatus.CRITICAL.value)
        assert last_activity_entry.value == str(IncidentStatus.CLOSED.value)

    @mock.patch("sentry.models.group.logger")
    def test_bulk_transition_new_group_to_ongoing__metric_issues__no_incident_activites(
        self, mock_logger
    ) -> None:
        """Ensure we do not trigger an IGOP write for a new to ongoing status change"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)
        assert open_period

        dummy_relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=dummy_relationship.incident_id)
        assert len(IncidentActivity.objects.filter(incident_id=incident.id)) == 3

        group.substatus = GroupSubStatus.NEW
        group.save()

        bulk_transition_group_to_ongoing(GroupStatus.UNRESOLVED, GroupSubStatus.NEW, [group.id])
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        assert mock_logger.error.call_count == 0

        assert (
            len(IncidentActivity.objects.filter(incident_id=incident.id)) == 3
        )  # no new IGOP entry

    @mock.patch("sentry.models.group.logger")
    def test_bulk_transition_regressed_group_to_ongoing__metric_issues__no_incident_activites(
        self, mock_logger
    ) -> None:
        """Ensure we do not trigger an IGOP write for a regressed to ongoing status change"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)
        assert open_period

        dummy_relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        incident = Incident.objects.get(id=dummy_relationship.incident_id)
        assert len(IncidentActivity.objects.filter(incident_id=incident.id)) == 3
        group.substatus = GroupSubStatus.REGRESSED
        group.save()

        bulk_transition_group_to_ongoing(
            GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED, [group.id]
        )
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        assert mock_logger.error.call_count == 0

        assert (
            len(IncidentActivity.objects.filter(incident_id=incident.id)) == 3
        )  # no new IGOP entry
