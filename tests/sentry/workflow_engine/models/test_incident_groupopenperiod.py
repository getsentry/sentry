from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.issues.ingest import save_issue_occurrence
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.workflow_engine.models import IncidentGroupOpenPeriod


@apply_feature_flag_on_cls("organizations:issue-open-periods")
class IncidentGroupOpenPeriodTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.alert_rule = self.create_alert_rule(
            organization=self.organization,
            projects=[self.project],
            name="Test Alert Rule",
        )
        self.group = self.create_group(project=self.project)
        self.group.type = MetricIssue.type_id
        self.group.save()

    def save_issue_occurrence(self, group_type=MetricIssue):
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data = {
            "id": "1",
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": ["test-fingerprint"],
            "issue_title": "Test Issue",
            "subtitle": "Test Subtitle",
            "resource_id": None,
            "evidence_data": {"alert_id": self.alert_rule.id},
            "evidence_display": [
                {"name": "Test Evidence", "value": "Test Value", "important": True}
            ],
            "type": group_type.type_id,
            "detection_time": timezone.now().timestamp(),
            "level": "error",
            "culprit": "test-culprit",
        }

        with patch("sentry.issues.ingest.eventstream") as _:
            occurrence, group_info = save_issue_occurrence(occurrence_data, event)

        assert group_info is not None
        assert group_info.group.type == group_type.type_id

        open_period = GroupOpenPeriod.objects.get(group=group_info.group)
        assert open_period is not None
        assert open_period.date_ended is None
        return occurrence, open_period

    def test_create_from_occurrence_with_existing_incident(self):
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

    def test_create_from_occurrence_without_incident(self):
        """Test creating placeholder when incident doesn't exist"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_from_occurrence(occurrence, self.group, open_period)

        assert result is None
        open_period.refresh_from_db()
        assert open_period.data["pending_incident_alert_id"] == self.alert_rule.id

    def test_create_from_occurrence_no_alert_id(self):
        """Test handling when no alert_id in evidence_data"""
        event = self.store_event(
            data={"timestamp": timezone.now().isoformat()}, project_id=self.project.id
        )

        occurrence_data = {
            "id": "2",
            "project_id": self.project.id,
            "event_id": event.event_id,
            "fingerprint": ["test-fingerprint-2"],
            "issue_title": "Test Issue 2",
            "subtitle": "Test Subtitle 2",
            "resource_id": None,
            "evidence_data": {},  # No alert_id
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
        open_period = GroupOpenPeriod.objects.get(group=group_info.group)

        result = IncidentGroupOpenPeriod.create_from_occurrence(
            occurrence, group_info.group, open_period
        )

        assert result is None

    def test_create_relationship_new(self):
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

    def test_create_relationship_existing(self):
        """Test updating an existing relationship"""
        occurrence, open_period = self.save_issue_occurrence()

        incident1 = self.create_incident(
            organization=self.organization,
            title="Test Incident 1",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        # Create initial relationship
        relationship = IncidentGroupOpenPeriod.create_relationship(incident1, open_period)
        assert relationship.incident_id == incident1.id

        # Create new incident and update relationship
        incident2 = self.create_incident(
            organization=self.organization,
            title="Test Incident 2",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        result = IncidentGroupOpenPeriod.create_relationship(incident2, open_period)

        assert result is not None
        assert result.incident_id == incident2.id
        assert result.incident_identifier == incident2.identifier
        assert result.group_open_period == open_period

    def test_create_placeholder_relationship(self):
        """Test creating a placeholder relationship"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_placeholder_relationship(
            self.alert_rule.id, open_period, self.project
        )

        assert result is None
        open_period.refresh_from_db()
        assert open_period.data["pending_incident_alert_id"] == self.alert_rule.id

    def test_create_pending_relationships_for_incident(self):
        """Test creating relationships for pending open periods"""
        occurrence, open_period = self.save_issue_occurrence()

        # Create a placeholder relationship
        open_period.data = {"pending_incident_alert_id": self.alert_rule.id}
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
        assert "pending_incident_alert_id" not in open_period.data

    def test_create_pending_relationships_for_incident_no_pending(self):
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
