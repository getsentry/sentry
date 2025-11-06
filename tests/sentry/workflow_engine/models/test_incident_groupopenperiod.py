import uuid
from datetime import timedelta
from typing import Any
from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.models.incident import Incident, IncidentActivity
from sentry.incidents.utils.constants import INCIDENTS_SNUBA_SUBSCRIPTION_TYPE
from sentry.issues.ingest import save_issue_occurrence
from sentry.issues.issue_occurrence import IssueOccurrenceData
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.snuba.subscriptions import create_snuba_query, create_snuba_subscription
from sentry.testutils.cases import TestCase
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
                project=self.detector.project,
                subscription_type=INCIDENTS_SNUBA_SUBSCRIPTION_TYPE,
                snuba_query=self.snuba_query,
            )

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

    def test_create_from_occurrence(self) -> None:
        """Test creating relationship and incident"""
        occurrence, open_period = self.save_issue_occurrence()

        result = IncidentGroupOpenPeriod.create_from_occurrence(occurrence, self.group, open_period)

        assert result is not None
        incident = Incident.objects.get(id=result.incident_id)
        activity = IncidentActivity.objects.filter(incident_id=incident.id)
        assert len(activity) == 3  # detected, created, status change
        assert result.group_open_period == open_period

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
