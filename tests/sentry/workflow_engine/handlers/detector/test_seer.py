from typing import Any
from unittest import mock
from uuid import UUID

import pytest

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.seer.models.run import SeerAgentRun
from sentry.workflow_engine.handlers.detector import DetectorGroupValues, DetectorOccurrence
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.handlers.detector.seer import (
    SeerDetectorHandler,
    SeerDetectorResult,
    deliver_seer_detector_result,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import DetectorPriorityLevel, DetectorSettings, DetectorType
from tests.sentry.issues.test_grouptype import BaseGroupTypeTest

FEATURE_ID = "test_seer_detector"
PRODUCE_PATH = (
    "sentry.workflow_engine.handlers.detector_outcome.issue_platform.produce_occurrence_to_kafka"
)


class MockSeerDetectorHandler(SeerDetectorHandler[dict[str, Any], dict[str, Any]]):
    """
    Sends each of the packet's `groups` to Seer, and triggers at HIGH when Seer's result
    is `{"anomalous": True}`.
    """

    seer_feature_id = FEATURE_ID

    def extract_value(
        self, data_packet: DataPacket[dict[str, Any]]
    ) -> DetectorGroupValues[dict[str, Any]]:
        return DetectorGroupValues(data_packet.packet["groups"])

    def evaluate_seer_result(
        self, result: SeerDetectorResult[dict[str, Any]]
    ) -> DetectorEvaluation | None:
        if result.result.get("anomalous"):
            return DetectorEvaluation.create_issue(result.group_key, DetectorPriorityLevel.HIGH)

        return None

    def create_seer_occurrence(
        self,
        evaluation: DetectorEvaluation,
        result: SeerDetectorResult[dict[str, Any]],
    ) -> tuple[DetectorOccurrence, EventData]:
        return (
            DetectorOccurrence(
                issue_title=result.result["title"],
                subtitle="Seer found an anomaly",
                type=self.detector.group_type,
                level="error",
                culprit=str(result.group_key),
            ),
            {},
        )


class MockWrongGroupKeyHandler(MockSeerDetectorHandler):
    def evaluate_seer_result(
        self, result: SeerDetectorResult[dict[str, Any]]
    ) -> DetectorEvaluation | None:
        return DetectorEvaluation.create_issue("other-group", DetectorPriorityLevel.HIGH)


class SeerDetectorHandlerTest(BaseGroupTypeTest):
    def setUp(self) -> None:
        super().setUp()

        class SeerGroupType(GroupType):
            type_id = 2
            slug = DetectorType.PERFORMANCE_SLOW_DB_QUERY
            description = "seer detector"
            category = GroupCategory.METRIC.value

        detector_settings_registry.registrations.pop(SeerGroupType.slug)

        @detector_settings_registry.register(SeerGroupType.slug)
        class SeerDetectorSettings(DetectorSettings):
            handler = MockSeerDetectorHandler

        self.detector = self.create_detector(project=self.project, type=SeerGroupType.slug)
        self.handler = MockSeerDetectorHandler(self.detector)

        access_patcher = mock.patch(
            "sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None)
        )
        self.has_seer_access = access_patcher.start()
        self.addCleanup(access_patcher.stop)

    def dispatch(self, groups: dict[str, dict[str, Any]]) -> list[SeerAgentRun]:
        packet = DataPacket(source_id="source-1", packet={"groups": groups})

        assert self.handler._evaluate(packet) == {}

        return list(SeerAgentRun.objects.filter(source=FEATURE_ID).select_related("run"))

    def deliver(
        self, agent_run: SeerAgentRun, result: dict[str, Any] | None, status: Any = "completed"
    ) -> mock.MagicMock:
        with mock.patch(PRODUCE_PATH) as produce:
            deliver_seer_detector_result(
                self.organization.id, agent_run.run.uuid, status, result, None
            )

        return produce

    def test_evaluate_starts_a_seer_run_per_group(self) -> None:
        runs = self.dispatch({"a": {"count": 1}, "b": {"count": 2}})

        assert {run.extras["group_key"]: run.extras for run in runs} == {
            "a": {
                "detector_id": self.detector.id,
                "data_packet_source_id": "source-1",
                "group_key": "a",
                "value": {"count": 1},
            },
            "b": {
                "detector_id": self.detector.id,
                "data_packet_source_id": "source-1",
                "group_key": "b",
                "value": {"count": 2},
            },
        }
        assert all(run.project_id == self.project.id for run in runs)

    def test_evaluate_skips_organizations_without_seer_access(self) -> None:
        self.has_seer_access.return_value = (False, "Seer is not available")

        assert self.dispatch({"a": {"count": 1}}) == []

    def test_delivery_creates_an_occurrence_for_a_triggered_result(self) -> None:
        [agent_run] = self.dispatch({"a": {"count": 1}})

        produce = self.deliver(agent_run, {"anomalous": True, "title": "Anomaly"})

        produce.assert_called_once()
        occurrence = produce.call_args.kwargs["occurrence"]
        event_data = produce.call_args.kwargs["event_data"]
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.issue_title == "Anomaly"
        assert occurrence.priority == DetectorPriorityLevel.HIGH
        assert occurrence.fingerprint == [f"detector:{self.detector.id}:a"]
        assert occurrence.evidence_data["value"] == {"count": 1}
        assert occurrence.evidence_data["data_packet_source_id"] == "source-1"
        # Redelivering the run's result produces the same event and occurrence ids
        assert occurrence.event_id == agent_run.run.uuid.hex
        assert event_data["event_id"] == occurrence.event_id

    def test_delivery_does_nothing_without_an_outcome(self) -> None:
        [agent_run] = self.dispatch({"a": {"count": 1}})

        self.deliver(agent_run, {"anomalous": False}).assert_not_called()

    def test_delivery_does_nothing_for_a_failed_run(self) -> None:
        [agent_run] = self.dispatch({"a": {"count": 1}})

        self.deliver(agent_run, None, status="error").assert_not_called()

    def test_delivery_does_nothing_for_a_disabled_detector(self) -> None:
        [agent_run] = self.dispatch({"a": {"count": 1}})
        Detector.objects.filter(id=self.detector.id).update(enabled=False)

        self.deliver(agent_run, {"anomalous": True, "title": "Anomaly"}).assert_not_called()

    def test_delivery_does_nothing_for_another_organization(self) -> None:
        [agent_run] = self.dispatch({"a": {"count": 1}})

        with mock.patch(PRODUCE_PATH) as produce:
            deliver_seer_detector_result(
                self.create_organization().id,
                agent_run.run.uuid,
                "completed",
                {"anomalous": True, "title": "Anomaly"},
                None,
            )

        produce.assert_not_called()

    def test_complete_evaluation_rejects_a_different_group_key(self) -> None:
        handler = MockWrongGroupKeyHandler(self.detector)

        with pytest.raises(ValueError):
            handler.complete_evaluation(
                SeerDetectorResult(
                    run_uuid=UUID(int=1),
                    group_key="a",
                    data_packet_source_id="source-1",
                    value={"count": 1},
                    result={},
                )
            )
