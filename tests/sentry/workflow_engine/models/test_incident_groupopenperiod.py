import uuid
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import IncidentStatus
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrenceData
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod, create_open_period
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import IncidentGroupOpenPeriod


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

    def save_issue_occurrence(self, include_alert_id: bool = True) -> tuple[Any, GroupOpenPeriod]:
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data: IssueOccurrenceData = {
            "id": str(uuid.uuid4()),
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": ["test-fingerprint"],
            "issue_title": "Test Issue",
            "subtitle": "Test Subtitle",
            "resource_id": None,
            "evidence_data": {"detector_id": self.detector.id} if include_alert_id else {},
            "evidence_display": [
                {"name": "Test Evidence", "value": "Test Value", "important": True}
            ],
            "type": MetricIssue.type_id,
            "detection_time": timezone.now().timestamp(),
            "level": "error",
            "culprit": "test-culprit",
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

    @with_feature("organizations:issue-open-periods")
    def test_create_from_occurrence_with_existing_incident(self) -> None:
        """Test creating relationship when incident exists"""
        occurrence, open_period = self.save_issue_occurrence()

        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        result = IncidentGroupOpenPeriod.create_from_occurrence(occurrence, self.group, open_period)

        assert result is not None
        assert result.incident_id == incident.id
        assert result.incident_identifier == incident.identifier
        assert result.group_open_period == open_period

    @with_feature("organizations:issue-open-periods")
    def test_create_from_occurrence_without_incident(self) -> None:
        """Test creating placeholder when incident doesn't exist"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_from_occurrence(occurrence, self.group, open_period)

        assert result is None
        open_period.refresh_from_db()
        assert open_period.data["pending_incident_detector_id"] == self.detector.id

    @with_feature("organizations:issue-open-periods")
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

    @with_feature("organizations:issue-open-periods")
    def test_create_relationship_new(self) -> None:
        """Test creating a new relationship"""
        occurrence, open_period = self.save_issue_occurrence()

        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        result = IncidentGroupOpenPeriod.create_relationship(incident, open_period)

        assert result is not None
        assert result.incident_id == incident.id
        assert result.incident_identifier == incident.identifier
        assert result.group_open_period == open_period

    @with_feature("organizations:issue-open-periods")
    def test_create_second_relationship(self) -> None:
        """Test creating a second relationship for a new incident"""
        _, open_period = self.save_issue_occurrence()

        incident1 = self.create_incident(
            organization=self.organization,
            title="Test Incident 1",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        # Create initial relationship
        relationship = IncidentGroupOpenPeriod.create_relationship(incident1, open_period)
        assert relationship.incident_id == incident1.id
        assert relationship.group_open_period == open_period

        incident1.status = IncidentStatus.CLOSED.value
        incident1.save()

        open_period.group.update(status=GroupStatus.RESOLVED)
        open_period.update(date_ended=timezone.now())
        create_open_period(open_period.group, timezone.now())
        open_period_2 = (
            GroupOpenPeriod.objects.filter(group=open_period.group)
            .order_by("-date_started")
            .first()
        )

        # Create new incident and new relationship
        incident2 = self.create_incident(
            organization=self.organization,
            title="Test Incident 2",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        result = IncidentGroupOpenPeriod.create_relationship(incident2, open_period_2)
        assert result is not None
        assert result.incident_id == incident2.id
        assert result.incident_identifier == incident2.identifier
        assert result.group_open_period == open_period_2

    @with_feature("organizations:issue-open-periods")
    def test_create_placeholder_relationship(self) -> None:
        """Test creating a placeholder relationship"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_placeholder_relationship(
            self.detector.id, open_period, self.project
        )

        assert result is None
        open_period.refresh_from_db()
        assert open_period.data["pending_incident_detector_id"] == self.detector.id

    @with_feature("organizations:issue-open-periods")
    def test_create_pending_relationships_for_incident(self) -> None:
        """Test creating relationships for pending open periods"""
        occurrence, open_period = self.save_issue_occurrence()

        # Create a placeholder relationship
        open_period.data = {"pending_incident_detector_id": self.detector.id}
        open_period.save()

        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        IncidentGroupOpenPeriod.create_pending_relationships_for_incident(incident, self.alert_rule)

        # Check that relationship was created
        relationship = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        assert relationship.incident_id == incident.id
        assert relationship.incident_identifier == incident.identifier

        # Check that placeholder was cleaned up
        open_period.refresh_from_db()
        assert "pending_incident_detector_id" not in open_period.data

    @with_feature("organizations:issue-open-periods")
    def test_create_pending_relationships_for_incident_no_pending(self) -> None:
        """Test creating relationships when no pending relationships exist"""
        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        # Should not raise any errors
        IncidentGroupOpenPeriod.create_pending_relationships_for_incident(incident, self.alert_rule)

        # No relationships should be created
        assert IncidentGroupOpenPeriod.objects.filter(incident_id=incident.id).count() == 0
