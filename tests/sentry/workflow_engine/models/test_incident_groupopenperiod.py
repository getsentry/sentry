import uuid
from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrenceData
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import IncidentGroupOpenPeriod
from sentry.workflow_engine.types import DetectorPriorityLevel


class IncidentGroupOpenPeriodTest(TestCase):
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
        self.group = self.create_group(project=self.project)
        self.group.type = MetricIssue.type_id
        self.group.save()

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

    def save_issue_occurrence(
        self, include_alert_id: bool = True, fingerprint: str = "test-fingerprint"
    ) -> tuple[Any, GroupOpenPeriod]:
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data: IssueOccurrenceData = {
            "id": str(uuid.uuid4()),
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": [fingerprint],
            "issue_title": "Test Issue",
            "subtitle": "Test Subtitle",
            "resource_id": None,
            "evidence_data": (
                {
                    "detector_id": self.detector.id,
                    "data_packet_source_id": str(self.query_subscription.id),
                }
                if include_alert_id
                else {}
            ),
            "evidence_display": [
                {"name": "Test Evidence", "value": "Test Value", "important": True}
            ],
            "type": MetricIssue.type_id,
            "detection_time": timezone.now().timestamp(),
            "level": "error",
            "culprit": "test-culprit",
            "priority": DetectorPriorityLevel.HIGH,
        }

        with patch("sentry.issues.ingest.eventstream") as _:
            occurrence, group_info = save_issue_occurrence(occurrence_data, event)

        assert group_info is not None
        assert group_info.group.type == MetricIssue.type_id

        open_period = (
            GroupOpenPeriod.objects.filter(group=group_info.group).order_by("-date_started").first()
        )
        assert open_period is not None
        assert open_period.date_ended is None
        return occurrence, open_period

    def get_incident_for_open_period(self, open_period: GroupOpenPeriod) -> Incident:
        relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)

        return Incident.objects.get(id=relationship.incident_id)

    def resolve_group(self, group: Group) -> None:
        Group.objects.update_group_status(
            groups=[group],
            status=GroupStatus.RESOLVED,
            substatus=None,
            activity_type=ActivityType.SET_RESOLVED,
            detector_id=self.detector.id,
        )

    def test_create_from_occurrence(self) -> None:
        """Test creating relationship and incident"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_from_occurrence(occurrence, self.group, open_period)

        assert result is not None
        incident = Incident.objects.get(id=result.incident_id)
        assert incident.status == IncidentStatus.CRITICAL.value
        assert incident.status_method == IncidentStatusMethod.RULE_TRIGGERED.value
        assert incident.date_closed is None
        assert result.incident_identifier == incident.identifier
        assert result.group_open_period == open_period

    def test_resolve_activation_while_previous_activation_still_open(self) -> None:
        """
        If a new activation opens a new group and the previous activation's open period never
        closed, we must still handle resolution gracefully
        """
        self.save_issue_occurrence(fingerprint="activation-1")

        _, second_open_period = self.save_issue_occurrence(fingerprint="activation-2")

        second_group = second_open_period.group

        self.resolve_group(second_group)

        second_group.refresh_from_db()

        second_open_period.refresh_from_db()

        assert second_group.status == GroupStatus.RESOLVED

        assert second_open_period.date_ended is not None

    def test_new_activation_closes_incident_whose_open_period_never_ended(self) -> None:
        _, first_open_period = self.save_issue_occurrence(fingerprint="activation-1")

        _, second_open_period = self.save_issue_occurrence(fingerprint="activation-2")

        first_incident = self.get_incident_for_open_period(first_open_period)

        second_incident = self.get_incident_for_open_period(second_open_period)

        time_window = timedelta(seconds=self.snuba_query.time_window)

        assert first_incident.status == IncidentStatus.CLOSED.value

        assert first_incident.date_closed == second_open_period.date_started - time_window

        assert second_incident.id != first_incident.id

        assert second_incident.date_closed is None

    def test_resolve_previous_activation_after_next_activation_opened(self) -> None:
        """
        Resolving a previous activation's open period should not affect the current one
        """
        _, first_open_period = self.save_issue_occurrence(fingerprint="activation-1")

        _, second_open_period = self.save_issue_occurrence(fingerprint="activation-2")

        self.resolve_group(first_open_period.group)

        first_incident = self.get_incident_for_open_period(first_open_period)

        second_incident = self.get_incident_for_open_period(second_open_period)

        assert first_incident.status == IncidentStatus.CLOSED.value

        assert second_incident.date_closed is None

    def test_resolve_unlinked_open_period_skips_incident_linked_elsewhere(self) -> None:
        """
        Ensure resolving an open period with no incident does not link it to an open incident
        that already belongs to another open period
        """
        _, linked_open_period = self.save_issue_occurrence(fingerprint="activation-1")

        unlinked_group = self.create_group(project=self.project, type=MetricIssue.type_id)

        self.create_detector_group(detector=self.detector, group=unlinked_group)

        self.resolve_group(unlinked_group)

        linked_incident = self.get_incident_for_open_period(linked_open_period)

        assert linked_incident.date_closed is None

        assert not IncidentGroupOpenPeriod.objects.filter(
            group_open_period__group=unlinked_group
        ).exists()

    def test_create_relationship_with_incident_linked_elsewhere(self) -> None:
        _, linked_open_period = self.save_issue_occurrence(fingerprint="activation-1")

        linked_incident = self.get_incident_for_open_period(linked_open_period)

        unlinked_group = self.create_group(project=self.project, type=MetricIssue.type_id)

        unlinked_open_period = GroupOpenPeriod.objects.get(group=unlinked_group)

        result = IncidentGroupOpenPeriod.create_relationship(linked_incident, unlinked_open_period)

        assert result is None

    def test_create_from_occurrence_no_alert_id(self) -> None:
        """Test handling when no alert_id in evidence_data"""
        with patch("sentry.issues.ingest.eventstream") as _:
            occurrence, group_info = self.save_issue_occurrence(include_alert_id=False)

        assert group_info is not None
        open_period = GroupOpenPeriod.objects.get(group=group_info.group)

        result = IncidentGroupOpenPeriod.create_from_occurrence(
            occurrence, group_info.group, open_period
        )

        assert result is None
