from typing import Any

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.processing_errors.grouptype import (
    SourcemapCheckStatus,
    SourcemapConfigurationType,
    SourcemapDetectorHandler,
    SourcemapPacketValue,
)
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.models.detector_state import DetectorState
from sentry.workflow_engine.types import DetectorEvaluationResult, DetectorPriorityLevel


class TestSourcemapDetectorHandler(TestCase):
    def create_sourcemap_detector(
        self,
        detector_state: DetectorPriorityLevel = DetectorPriorityLevel.OK,
    ) -> Detector:
        condition_group = self.create_data_condition_group(
            organization=self.project.organization,
        )
        self.create_data_condition(
            comparison=SourcemapCheckStatus.FAILURE,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )
        self.create_data_condition(
            comparison=SourcemapCheckStatus.SUCCESS,
            type=Condition.EQUAL,
            condition_result=DetectorPriorityLevel.OK,
            condition_group=condition_group,
        )
        detector = self.create_detector(
            type=SourcemapConfigurationType.slug,
            project=self.project,
            name="Sourcemap Configuration",
            config={},
            workflow_condition_group=condition_group,
        )
        self.create_detector_state(
            detector=detector,
            state=detector_state,
            is_triggered=detector_state == DetectorPriorityLevel.HIGH,
        )
        return detector

    def make_packet(
        self,
        errors: list | None = None,
        event_id: str = "abc123",
        platform: str = "javascript",
    ) -> DataPacket[SourcemapPacketValue]:
        if errors is None:
            errors = []
        event_data: dict[str, Any] = {
            "errors": errors,
            "platform": platform,
            "sdk": {"name": "sentry.javascript.browser", "version": "7.0.0"},
        }
        return DataPacket(
            source_id=str(self.project.id),
            packet=SourcemapPacketValue(
                event_id=event_id,
                event_data=event_data,
            ),
        )

    def handle_result(
        self, detector: Detector, data_packet: DataPacket[SourcemapPacketValue]
    ) -> DetectorEvaluationResult | None:
        handler = SourcemapDetectorHandler(detector)
        evaluation = handler.evaluate(data_packet)
        if None not in evaluation:
            return None
        return evaluation[None]

    def test_failure_creates_occurrence(self) -> None:
        detector = self.create_sourcemap_detector()

        errors = [
            {"type": "js_no_source", "url": "https://example.com/app.js"},
            {"type": "js_invalid_source", "url": "https://example.com/vendor.js"},
        ]

        result = self.handle_result(
            detector,
            self.make_packet(errors=errors, event_id="test-event-123", platform="javascript"),
        )

        assert result is not None
        assert result.priority == DetectorPriorityLevel.HIGH
        assert isinstance(result.result, IssueOccurrence)
        assert result.result.issue_title == "Broken source maps detected"
        assert result.result.evidence_data["error_types"] == ["js_invalid_source", "js_no_source"]
        assert result.result.evidence_data["sample_event_id"] == "test-event-123"
        assert result.event_data is not None
        assert result.event_data["platform"] == "javascript"

        state = DetectorState.objects.get(detector=detector)
        assert state.is_triggered is True
        assert state.state == str(DetectorPriorityLevel.HIGH)

    def test_duplicate_failure_does_not_trigger(self) -> None:
        detector = self.create_sourcemap_detector()
        packet = self.make_packet(
            errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
        )

        result = self.handle_result(detector, packet)
        assert result is not None
        assert isinstance(result.result, IssueOccurrence)

        result = self.handle_result(detector, packet)
        assert result is None

    def test_no_sourcemap_errors_does_not_trigger(self) -> None:
        detector = self.create_sourcemap_detector()

        assert self.handle_result(detector, self.make_packet(errors=[])) is None
        assert (
            self.handle_result(
                detector,
                self.make_packet(errors=[{"type": "native_missing_dsym", "image": "libfoo.so"}]),
            )
            is None
        )

    def test_failure_without_detector_state_creates_it(self) -> None:
        detector = self.create_sourcemap_detector()
        DetectorState.objects.filter(detector=detector).delete()

        result = self.handle_result(
            detector,
            self.make_packet(
                errors=[{"type": "js_no_source", "url": "https://example.com/app.js"}],
            ),
        )

        assert result is not None
        assert isinstance(result.result, IssueOccurrence)
        state = DetectorState.objects.get(detector=detector)
        assert state.is_triggered is True
