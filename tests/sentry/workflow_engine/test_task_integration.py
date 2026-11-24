from datetime import timedelta
from typing import Any
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.types import Message
from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.issues.ingest import hash_fingerprint
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import update_status
from sentry.issues.status_change_message import StatusChangeMessageData
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus
from sentry.uptime.grouptype import UptimeDomainCheckFailure
from sentry.utils import json
from sentry.workflow_engine.handlers.detector import DetectorOccurrence
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models import DataPacket, Detector, DetectorGroup, DetectorState
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.detector import process_detectors
from sentry.workflow_engine.registry import detector_settings_registry
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
)
from sentry.workflow_engine.utils.fingerprinting import build_detector_issue_fingerprint
from tests.sentry.issues.test_status_change_consumer import get_test_message_status_change
from tests.sentry.workflow_engine.handlers.detector.test_base import (
    MockDefaultDetectorHandler,
    MockDetectorStateHandler,
)

FINDING_ISSUE_TYPES = {"http": UptimeDomainCheckFailure, "db": MetricIssue}


def build_finding_occurrence(
    evaluation: DetectorEvaluation,
) -> tuple[DetectorOccurrence, EventData]:
    group_key = evaluation.data["group_key"]
    assert group_key is not None
    finding_type, _, problem_key = group_key.partition(":")
    return (
        DetectorOccurrence(
            issue_title=f"{finding_type} finding: {problem_key}",
            subtitle="Multi-type detector finding",
            type=FINDING_ISSUE_TYPES[finding_type],
            level="error",
            culprit=problem_key,
        ),
        {},
    )


class MultiIssueDetectorHandler(MockDefaultDetectorHandler):
    def get_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        assert group_key is not None
        finding_type, _, problem_key = group_key.partition(":")
        return build_detector_issue_fingerprint(
            self.detector.id, FINDING_ISSUE_TYPES[finding_type].type_id, problem_key
        )

    def create_occurrence(
        self, evaluation: DetectorEvaluation, data_packet: DataPacket[dict[str, Any]]
    ) -> tuple[DetectorOccurrence, EventData]:
        return build_finding_occurrence(evaluation)


class MultiIssueStatefulDetectorHandler(MockDetectorStateHandler):
    def create_occurrence(
        self, evaluation: DetectorEvaluation, data_packet: DataPacket[dict[str, Any]]
    ) -> tuple[DetectorOccurrence, EventData]:
        return build_finding_occurrence(evaluation)


class MultiIssueDetectorIntegrationTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.consumed_group_ids: list[int] = []

        class MultiIssueSettings(DetectorSettings):
            handler = MultiIssueDetectorHandler

        class StatefulMultiIssueSettings(DetectorSettings):
            handler = MultiIssueStatefulDetectorHandler

        self.enterContext(
            mock.patch.dict(
                detector_settings_registry.registrations,
                {
                    DetectorType.PERFORMANCE_SLOW_DB_QUERY: MultiIssueSettings,
                    DetectorType.QUERY_INJECTION_VULNERABILITY: MultiIssueSettings,
                    DetectorType.PERFORMANCE_LARGE_HTTP_PAYLOAD: StatefulMultiIssueSettings,
                },
            )
        )
        # Use the producer's synchronous path, but let consumer errors fail the test.
        self.enterContext(
            self.settings(SENTRY_EVENTSTREAM="sentry.eventstream.snuba.SnubaEventStream")
        )
        self.enterContext(
            mock.patch("sentry.issues.producer.process_message", side_effect=self.consume_message)
        )

    def consume_message(self, message: Message[KafkaPayload]) -> None:
        result = _process_message(json.loads(message.payload.value))
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        self.consumed_group_ids.append(group_info.group.id)

    def create_finding_detector(self, detector_type: DetectorType) -> Detector:
        condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.GREATER,
            comparison=5,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        self.create_data_condition(
            condition_group=condition_group,
            type=Condition.LESS_OR_EQUAL,
            comparison=5,
            condition_result=DetectorPriorityLevel.OK,
        )
        return self.create_detector(
            project=self.project,
            type=detector_type,
            workflow_condition_group=condition_group,
        )

    def group_for_fingerprint(self, fingerprint: list[str]) -> Group:
        return Group.objects.get(
            project=self.project, grouphash__hash=hash_fingerprint(fingerprint)[0]
        )

    def test_multiple_issue_types_and_problems_keep_their_grouping_on_repeat(self) -> None:
        detector = self.create_finding_detector(DetectorType.PERFORMANCE_SLOW_DB_QUERY)
        packet = DataPacket(
            "findings",
            {"values": {"http:resource": 10, "db:resource": 10, "db:other-resource": 10}},
        )
        results = process_detectors(packet, [detector])
        assert set(results[0][1]) == {"http:resource", "db:resource", "db:other-resource"}

        http = self.group_for_fingerprint(
            build_detector_issue_fingerprint(
                detector.id, UptimeDomainCheckFailure.type_id, "resource"
            )
        )
        db = self.group_for_fingerprint(
            build_detector_issue_fingerprint(detector.id, MetricIssue.type_id, "resource")
        )
        other_db = self.group_for_fingerprint(
            build_detector_issue_fingerprint(detector.id, MetricIssue.type_id, "other-resource")
        )
        assert http.type == UptimeDomainCheckFailure.type_id
        assert db.type == other_db.type == MetricIssue.type_id
        assert len({http.id, db.id, other_db.id}) == 3
        assert set(
            DetectorGroup.objects.filter(detector=detector).values_list("group_id", flat=True)
        ) == {http.id, db.id, other_db.id}

        process_detectors(packet, [detector])

        assert self.consumed_group_ids == [http.id, db.id, other_db.id] * 2
        assert DetectorGroup.objects.filter(detector=detector).count() == 3

    def test_different_implementations_emit_same_issue_type_into_separate_issues(self) -> None:
        first = self.create_finding_detector(DetectorType.PERFORMANCE_SLOW_DB_QUERY)
        second = self.create_finding_detector(DetectorType.QUERY_INJECTION_VULNERABILITY)
        process_detectors(DataPacket("findings", {"values": {"db:resource": 10}}), [first, second])

        first_issue = self.group_for_fingerprint(
            build_detector_issue_fingerprint(first.id, MetricIssue.type_id, "resource")
        )
        second_issue = self.group_for_fingerprint(
            build_detector_issue_fingerprint(second.id, MetricIssue.type_id, "resource")
        )
        assert first_issue.type == second_issue.type == MetricIssue.type_id
        assert first_issue.id != second_issue.id
        assert DetectorGroup.objects.get(group=first_issue).detector_id == first.id
        assert DetectorGroup.objects.get(group=second_issue).detector_id == second.id

    def test_stateful_findings_resolve_and_reactivate_independently(self) -> None:
        detector = self.create_finding_detector(DetectorType.PERFORMANCE_LARGE_HTTP_PAYLOAD)
        triggered = DataPacket(
            "findings", {"dedupe": 1, "group_vals": {"http:resource": 10, "db:resource": 10}}
        )
        process_detectors(triggered, [detector])
        http = self.group_for_fingerprint([f"detector:{detector.id}:http:resource"])
        db = self.group_for_fingerprint([f"detector:{detector.id}:db:resource"])
        assert http.type == UptimeDomainCheckFailure.type_id
        assert db.type == MetricIssue.type_id
        assert process_detectors(triggered, [detector]) == []

        process_detectors(
            DataPacket("findings", {"dedupe": 2, "group_vals": {"db:resource": 0}}), [detector]
        )

        db.refresh_from_db()
        http.refresh_from_db()
        assert db.status == GroupStatus.RESOLVED
        assert http.status == GroupStatus.UNRESOLVED
        assert dict(
            DetectorState.objects.filter(detector=detector).values_list(
                "detector_group_key", "is_triggered"
            )
        ) == {"db:resource": False, "http:resource": True}

        # Advance past the Issue Platform's five-second regression race window.
        with freeze_time(timezone.now() + timedelta(seconds=10)):
            process_detectors(
                DataPacket("findings", {"dedupe": 3, "group_vals": {"db:resource": 10}}), [detector]
            )

        db.refresh_from_db()
        assert db.status == GroupStatus.UNRESOLVED
        assert self.consumed_group_ids == [http.id, db.id, db.id, db.id]
        assert self.group_for_fingerprint([f"detector:{detector.id}:db:resource"]).id == db.id
        assert DetectorGroup.objects.filter(detector=detector).count() == 2
        assert DetectorState.objects.filter(detector=detector, is_triggered=True).count() == 2


class IssuePlatformIntegrationTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(project=self.project)
        self.group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )
        self.fingerprint = f"detector:{self.detector.id}"
        self.hashed_fingerprint = hash_fingerprint([self.fingerprint])
        GroupHash.objects.create(
            project=self.project,
            hash=self.hashed_fingerprint[0],
            group=self.group,
        )

    def test_handler_invoked__when_update_status_called(self) -> None:
        """
        Integration test to ensure the `update_status` method trigger workflow_engine
        """
        message = get_test_message_status_change(
            project_id=self.project.id,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
        )

        with mock.patch("sentry.workflow_engine.tasks.workflows.metrics.incr") as mock_incr:
            with self.tasks():
                _process_message(message)

            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflows.activity_update.executed",
                tags={
                    "activity_type": ActivityType.SET_RESOLVED.value,
                    "detector_type": self.detector.type,
                },
                sample_rate=1.0,
            )

    def test_handler_invoked__when_resolved(self) -> None:
        """
        Integration test to ensure the `update_status` method trigger workflow_engine
        and increment the metric.
        """
        message = StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
            activity_data={"test": "test"},
        )

        with mock.patch("sentry.workflow_engine.tasks.workflows.metrics.incr") as mock_incr:
            with self.tasks():
                update_status(self.group, message)
            mock_incr.assert_any_call(
                "workflow_engine.tasks.process_workflows.activity_update.executed",
                tags={
                    "activity_type": ActivityType.SET_RESOLVED.value,
                    "detector_type": self.detector.type,
                },
                sample_rate=1.0,
            )

    def _resolved_message(self) -> StatusChangeMessageData:
        return StatusChangeMessageData(
            id="test_message_id",
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            fingerprint=[self.fingerprint],
            detector_id=self.detector.id,
            activity_data={"test": "test"},
        )
