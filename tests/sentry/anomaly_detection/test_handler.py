from dataclasses import replace
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from confluent_kafka import KafkaException
from django.test import override_settings

from sentry.anomaly_detection.contracts import ChangeType, SeriesKey
from sentry.anomaly_detection.delivery.outbox import publish_anomaly_transition
from sentry.anomaly_detection.delivery.transition import AnomalyTransition
from sentry.anomaly_detection.detector_handler import (
    AnomalyDetectionDetectorHandler,
    MeasurementEvaluation,
    MinuteMeasurements,
)
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftTracker
from sentry.anomaly_detection.evaluation.series import SeriesRow
from sentry.anomaly_detection.evaluation.series_history import SeriesHistory
from sentry.anomaly_detection.grouptype import AnomalyDetection
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import Group, GroupStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorAPIOperation, DetectorPriorityLevel, DetectorType


class TestAnomalyDetectionHandler(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            project=self.project, type=DetectorType.ANOMALY_DETECTION
        )
        handler = self.detector.detector_handler
        assert isinstance(handler, AnomalyDetectionDetectorHandler)
        self.handler = handler
        self.transition = AnomalyTransition(
            group_key="correlated-anomaly",
            project_id=self.project.id,
            timestamp=before_now(minutes=2),
            priority=DetectorPriorityLevel.HIGH,
            is_resolved=False,
            title="Service errors increased",
            evidence={"other-project": "private-evidence"},
            env="production",
        )

    def evaluate(self, transition: AnomalyTransition) -> DetectorEvaluation:
        return self.handler._evaluate(DataPacket(source_id="source", packet=transition))[
            transition.group_key
        ]

    def test_registration(self) -> None:
        settings = detector_settings_registry.get(DetectorType.ANOMALY_DETECTION)
        assert settings.handler is AnomalyDetectionDetectorHandler
        assert settings.api_availability == {operation: False for operation in DetectorAPIOperation}
        assert settings.config_schema == {
            "type": "object",
            "properties": {},
            "additionalProperties": False,
        }
        assert self.detector.group_type is AnomalyDetection
        assert not AnomalyDetection.allow_ingest(self.organization)

    def test_scores_project_measurements_with_loaded_history(self) -> None:
        minute = datetime(2024, 1, 8, 13)
        project = str(self.project.id)
        other_project = str(self.project.id + 1)
        key = SeriesKey(project, "production", "errors", "count()")
        other_key = replace(key, project=other_project)

        def row(ts: datetime, value: float, project_id: str = project) -> SeriesRow:
            return (ts, "errors", "count()", project_id, "production", "", value)

        hourly = self.handler.load_baseline(
            [
                row(minute - timedelta(days=day, hours=hour), value)
                for day in range(1, 8)
                for hour, value in ((0, 10.0), (1, 5.0))
            ]
        )
        baseline = Baseline(hourly)
        history = SeriesHistory({other_key: {minute: 100.0}}, baseline)
        change_points = RateShiftTracker(history.series, baseline)

        def evaluate(ts: datetime, *rows: SeriesRow) -> MeasurementEvaluation:
            packet = DataPacket(source_id="measurements", packet=MinuteMeasurements(ts, rows))
            return self.handler.evaluate_measurements(packet, history, change_points)

        with pytest.raises(ValueError, match="project must match"):
            self.handler.load_baseline([row(minute, 3.0, other_project)])
        with pytest.raises(ValueError, match="project must match"):
            evaluate(minute, row(minute, 100.0), row(minute, 100.0, other_project))
        with pytest.raises(ValueError, match="timestamps must match"):
            evaluate(minute, row(minute, 100.0), row(minute + timedelta(minutes=1), 100.0))
        assert history.series == {other_key: {minute: 100.0}}

        for offset in range(60, 0, -1):
            ts = minute - timedelta(minutes=offset)
            result = evaluate(ts, row(ts, 5.0))
            assert result.observed == {key}
            assert result.changes == []

        assert evaluate(minute, row(minute, 100.0)).changes == []
        empty_minute = minute + timedelta(minutes=1)
        result = evaluate(empty_minute)
        assert not result.observed and not result.changes
        assert history.state[key].recent[-1] == (empty_minute, False, None)
        assert not history.state[other_key].recent

        next_minute = minute + timedelta(minutes=2)
        assert evaluate(next_minute, row(next_minute, 100.0)).changes == []
        last_minute = minute + timedelta(minutes=3)
        [(action, event)] = evaluate(last_minute, row(last_minute, 100.0)).changes
        assert action == "open"
        assert event.key == key
        assert event.change_type == ChangeType.SPIKE
        assert event.detected_at == last_minute
        assert event.expected == 10.0

    def test_trigger_and_recovery_identity(self) -> None:
        evaluation = self.evaluate(self.transition)
        occurrence = evaluation.result
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.type is AnomalyDetection
        assert occurrence.priority == DetectorPriorityLevel.HIGH
        assert "private-evidence" not in repr(occurrence.to_dict())
        event_data = evaluation.data["event_data"]
        assert event_data is not None
        assert event_data["environment"] == "production"

        retry = self.evaluate(
            replace(
                self.transition,
                timestamp=self.transition.timestamp.astimezone(timezone(timedelta(hours=2))),
                evidence={},
            )
        ).result
        assert isinstance(retry, IssueOccurrence)
        assert retry.id == occurrence.id
        assert retry.event_id == occurrence.event_id

        next_open = self.evaluate(
            replace(self.transition, timestamp=self.transition.timestamp + timedelta(minutes=1))
        ).result
        assert isinstance(next_open, IssueOccurrence)
        assert next_open.fingerprint == occurrence.fingerprint
        assert next_open.event_id != occurrence.event_id

        recovery = replace(self.transition, is_resolved=True, priority=DetectorPriorityLevel.OK)
        close = self.evaluate(recovery).result
        assert isinstance(close, StatusChangeMessage)
        assert close.fingerprint == occurrence.fingerprint
        assert close.new_status == GroupStatus.RESOLVED
        assert close.detector_id == self.detector.id
        assert close.id != occurrence.event_id
        assert self.evaluate(recovery).result == close

        other = self.evaluate(replace(self.transition, group_key="other-anomaly")).result
        assert isinstance(other, IssueOccurrence)
        assert other.fingerprint != occurrence.fingerprint
        assert other.event_id != occurrence.event_id

    def test_rejects_cross_project_transition(self) -> None:
        with pytest.raises(ValueError, match="project must match"):
            self.evaluate(replace(self.transition, project_id=self.project.id + 1))

    @requires_snuba
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.dummy.DummyEventStream")
    def test_dev_publish_creates_and_resolves_issue(self) -> None:
        with self.feature(AnomalyDetection.build_ingest_feature_name()):
            publish_anomaly_transition(self.detector, self.transition)
            group = Group.objects.get(project=self.project, type=AnomalyDetection.type_id)
            assert group.status == GroupStatus.UNRESOLVED

            publish_anomaly_transition(
                self.detector,
                replace(
                    self.transition,
                    is_resolved=True,
                    priority=DetectorPriorityLevel.OK,
                    timestamp=self.transition.timestamp + timedelta(minutes=1),
                ),
            )
            group.refresh_from_db()
            assert group.status == GroupStatus.RESOLVED

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_publish_propagates_failed_broker_ack(self) -> None:
        with patch("sentry.issues.producer._confirmed_occurrence_producer") as producer:
            future = producer.produce.return_value
            future.result.side_effect = KafkaException("delivery failed")
            with pytest.raises(KafkaException, match="delivery failed"):
                publish_anomaly_transition(self.detector, self.transition)
            future.result.assert_called_once_with(timeout=30)
