from unittest.mock import patch

from django.utils import timezone

from sentry.event_manager import GroupInfo
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData
from sentry.models.group import GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.workflow_engine.models import IncidentGroupOpenPeriod


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

    def save_issue_occurrence(
        self, group_type: int = MetricIssue.type_id
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
            "evidence_data": {"detector_id": self.detector.id},
            "evidence_display": [
                {"name": "Test Evidence", "value": "Test Value", "important": True}
            ],
            "type": group_type,
            "detection_time": timezone.now().timestamp(),
            "level": "error",
            "culprit": "test-culprit",
        }

        with patch("sentry.issues.ingest.eventstream") as _:
            occurrence, group_info = save_issue_occurrence(occurrence_data, event)

        assert group_info is not None
        assert group_info.group.type == group_type
        return occurrence, group_info

    @with_feature("organizations:issue-open-periods")
    def test_save_issue_occurrence_creates_relationship_when_incident_exists(self) -> None:
        """Test that save_issue_occurrence creates the relationship when incident exists"""
        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group)
        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        assert item.incident_id == incident.id
        assert item.incident_identifier == incident.identifier

    @with_feature("organizations:issue-open-periods")
    def test_save_issue_occurrence_creates_placeholder_when_incident_doesnt_exist(self) -> None:
        """Test that save_issue_occurrence creates placeholder when incident doesn't exist"""
        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert open_period.data["pending_incident_detector_id"] == self.detector.id

        assert not IncidentGroupOpenPeriod.objects.filter(group_open_period=open_period).exists()

    @with_feature("organizations:issue-open-periods")
    def test_save_issue_occurrence_creates_relationship_for_existing_group(self) -> None:
        """Test that save_issue_occurrence creates relationship for existing groups"""
        incident = self.create_incident(
            organization=self.organization,
            title="Test Incident",
            date_started=timezone.now(),
            alert_rule=self.alert_rule,
        )

        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        assert GroupOpenPeriod.objects.filter(group=group, project=self.project).exists()

        group.update(status=GroupStatus.RESOLVED)
        open_period = GroupOpenPeriod.objects.get(group=group, project=self.project)
        open_period.update(date_ended=timezone.now())

        _, group_info = self.save_issue_occurrence()
        group = group_info.group
        assert group is not None

        item = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period)
        assert item.incident_id == incident.id
        assert item.incident_identifier == incident.identifier

    @with_feature("organizations:issue-open-periods")
    def test_save_issue_occurrence_no_relationship_for_non_metric_issues(self) -> None:
        # Test that save_issue_occurrence doesn't create relationships for non-metric issues
        _, group_info = self.save_issue_occurrence(group_type=FeedbackGroup.type_id)

        group = group_info.group
        assert group is not None

        open_period = GroupOpenPeriod.objects.get(group=group)
        assert not IncidentGroupOpenPeriod.objects.filter(group_open_period=open_period).exists()
        assert "pending_incident_alert_id" not in open_period.data
