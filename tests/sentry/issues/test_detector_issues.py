from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.models.incident import IncidentStatus
from sentry.issues.detector_issues import (
    build_fingerprint_from_incident,
    build_occurrence_from_incident,
    create_detector_issue_occurrence,
)
from sentry.issues.grouptype import DetectorControlledIssueType
from sentry.testutils.cases import TestCase


class DetectorControlledIssueTest(TestCase):
    def setUp(self) -> None:
        self.detected_at = timezone.now() - timedelta(minutes=5)
        self.alert_rule = self.create_alert_rule(
            projects=[self.project],
        )

        self.incident = self.create_incident(
            organization=self.organization,
            projects=[self.project],
            date_started=self.detected_at,
            date_detected=self.detected_at,
            alert_rule=self.alert_rule,
            status=IncidentStatus.CRITICAL.value,
        )

    @patch("sentry.issues.detector_issues.produce_occurrence_to_kafka")
    def test_create_detector_issue_occurrence(self, produce_occurrence_to_kafka):
        create_detector_issue_occurrence(self.incident)
        assert produce_occurrence_to_kafka.called

    def test_build_fingerprint_from_incident(self):
        data = {"key1": "value1", "key2": "value2"}
        fingerprint = build_fingerprint_from_incident(self.incident, data)
        assert fingerprint == [str(self.incident.id), "key1:value1", "key2:value2"]

        data = {}
        fingerprint = build_fingerprint_from_incident(self.incident, data)
        assert fingerprint == [str(self.incident.id)]

    def test_build_occurrence_from_incident(self):
        occurrence = build_occurrence_from_incident(self.incident)
        assert occurrence.project_id == self.project.id
        assert occurrence.issue_title == self.incident.title
        assert occurrence.type == DetectorControlledIssueType
        assert occurrence.initial_issue_priority == "high"
        assert occurrence.subtitle == "Alert rule exceeded critical threshold"
        assert occurrence.detection_time == self.detected_at
