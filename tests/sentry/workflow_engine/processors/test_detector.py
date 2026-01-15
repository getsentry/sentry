import unittest
import uuid
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, call, patch

import pytest
from django.utils import timezone

from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.issues.grouptype import FeedbackGroup, PerformanceNPlusOneAPICallsGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.services.eventstore.models import GroupEvent
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.utils.cache import cache
from sentry.workflow_engine.handlers.detector import DetectorStateData
from sentry.workflow_engine.handlers.detector.stateful import get_redis_client
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.processors.detector import (
    associate_new_group_with_detector,
    ensure_association_with_detector,
    get_detectors_for_event_data,
    get_preferred_detector,
    process_detectors,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorPriorityLevel,
    WorkflowEventData,
)
from sentry.workflow_engine.typings.grouptype import IssueStreamGroupType
from tests.sentry.workflow_engine.handlers.detector.test_base import (
    BaseDetectorHandlerTest,
    MockDetectorStateHandler,
    build_mock_occurrence_and_event,
)


class TestInit(BaseDetectorHandlerTest):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(
            type=self.handler_type.slug,
            workflow_condition_group=self.create_data_condition_group(),
        )
        cache.clear()

    def test_no_caching(self) -> None:
        # Refetch without `.select_related` to make sure that the object isn't cached
        self.detector = Detector.objects.get(id=self.detector.id)
        with self.assertNumQueries(1):
            self.detector.detector_handler

    def test_caching(self) -> None:
        # Refetch with `.select_related` to make sure that the object iscached
        self.detector = Detector.objects.select_related("workflow_condition_group").get(
            id=self.detector.id
        )
        with self.assertNumQueries(0):
            self.detector.detector_handler


@freeze_time()
class TestProcessDetectors(BaseDetectorHandlerTest):
    def setUp(self) -> None:
        super().setUp()

    def build_data_packet(self, **kwargs: Any) -> DataPacket[dict[str, Any]]:
        source_id = "1234"
        return DataPacket[dict[str, Any]](
            source_id, {"source_id": source_id, "group_vals": {"group_1": 6}, **kwargs}
        )

    def test(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        data_packet = self.build_data_packet()
        results = process_detectors(data_packet, [detector])
        assert results == [
            (
                detector,
                {None: DetectorEvaluationResult(None, True, DetectorPriorityLevel.HIGH)},
            )
        ]

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_state_results(self, mock_produce_occurrence_to_kafka: MagicMock) -> None:
        detector, _ = self.create_detector_and_condition(type=self.handler_state_type.slug)
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}})
        results = process_detectors(data_packet, [detector])

        detector_occurrence, event_data = build_mock_occurrence_and_event(
            detector.detector_handler, None, PriorityLevel.HIGH
        )

        issue_occurrence, expected_event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=detector,
            group_key=None,
            value=6,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result = DetectorEvaluationResult(
            None,
            True,
            DetectorPriorityLevel.HIGH,
            issue_occurrence,
            expected_event_data,
        )
        assert results == [
            (
                detector,
                {result.group_key: result},
            )
        ]
        mock_produce_occurrence_to_kafka.assert_called_once_with(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=issue_occurrence,
            status_change=None,
            event_data=expected_event_data,
        )

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    def test_state_results_multi_group(self, mock_produce_occurrence_to_kafka: MagicMock) -> None:
        detector, _ = self.create_detector_and_condition(type=self.handler_state_type.slug)
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {"group_1": 6, "group_2": 10}})
        results = process_detectors(data_packet, [detector])

        detector_occurrence_1, _ = build_mock_occurrence_and_event(
            detector.detector_handler, "group_1", PriorityLevel.HIGH
        )

        issue_occurrence_1, event_data_1 = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence_1,
            detector=detector,
            group_key="group_1",
            value=6,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result_1 = DetectorEvaluationResult(
            "group_1",
            True,
            DetectorPriorityLevel.HIGH,
            issue_occurrence_1,
            event_data_1,
        )

        detector_occurrence_2, _ = build_mock_occurrence_and_event(
            detector.detector_handler, "group_2", PriorityLevel.HIGH
        )

        issue_occurrence_2, event_data_2 = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence_2,
            detector=detector,
            group_key="group_2",
            value=10,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result_2 = DetectorEvaluationResult(
            "group_2",
            True,
            DetectorPriorityLevel.HIGH,
            issue_occurrence_2,
            event_data_2,
        )
        assert results == [
            (
                detector,
                {result_1.group_key: result_1, result_2.group_key: result_2},
            )
        ]
        mock_produce_occurrence_to_kafka.assert_has_calls(
            [
                call(
                    payload_type=PayloadType.OCCURRENCE,
                    occurrence=issue_occurrence_1,
                    status_change=None,
                    event_data=event_data_1,
                ),
                call(
                    payload_type=PayloadType.OCCURRENCE,
                    occurrence=issue_occurrence_2,
                    status_change=None,
                    event_data=event_data_2,
                ),
            ],
            any_order=True,
        )

    def test_no_handler(self) -> None:
        detector = self.create_detector(type=self.no_handler_type.slug)
        data_packet = self.build_data_packet()
        with mock.patch("sentry.workflow_engine.models.detector.logger") as mock_logger:
            with pytest.raises(ValueError):
                results = process_detectors(data_packet, [detector])
                assert (
                    mock_logger.error.call_args[0][0]
                    == "Registered grouptype for detector has no detector_handler"
                )

                assert results == []

    def test_sending_metric_before_evaluating(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        data_packet = self.build_data_packet()

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            process_detectors(data_packet, [detector])

            mock_incr.assert_any_call(
                "workflow_engine.process_detector",
                tags={"detector_type": detector.type},
            )
            mock_incr.assert_any_call(
                "workflow_engine_detector.evaluation",
                tags={"detector_type": detector.type, "result": "success"},
                sample_rate=1.0,
            )

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    @mock.patch("sentry.workflow_engine.processors.detector.metrics")
    @mock.patch("sentry.workflow_engine.processors.detector.logger")
    def test_metrics_and_logs_fire(
        self,
        mock_logger: mock.MagicMock,
        mock_metrics: mock.MagicMock,
        mock_produce_occurrence_to_kafka: mock.MagicMock,
    ) -> None:
        detector, _ = self.create_detector_and_condition(type=self.handler_state_type.slug)
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}})
        results = process_detectors(data_packet, [detector])

        detector_occurrence, event_data = build_mock_occurrence_and_event(
            detector.detector_handler, None, PriorityLevel.HIGH
        )

        issue_occurrence, expected_event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=detector,
            group_key=None,
            value=6,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result = DetectorEvaluationResult(
            group_key=None,
            is_triggered=True,
            priority=DetectorPriorityLevel.HIGH,
            result=issue_occurrence,
            event_data=expected_event_data,
        )
        assert results == [
            (
                detector,
                {result.group_key: result},
            )
        ]
        mock_produce_occurrence_to_kafka.assert_called_once_with(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=issue_occurrence,
            status_change=None,
            event_data=expected_event_data,
        )
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "workflow_engine.process_detector.triggered",
                    tags={"detector_type": detector.type},
                ),
            ],
        )
        assert mock_logger.info.call_count == 1
        assert mock_logger.info.call_args[0][0] == "detector_triggered"

    @mock.patch("sentry.workflow_engine.processors.detector.produce_occurrence_to_kafka")
    @mock.patch("sentry.workflow_engine.processors.detector.metrics")
    @mock.patch("sentry.workflow_engine.processors.detector.logger")
    def test_metrics_and_logs_resolve(
        self,
        mock_logger: mock.MagicMock,
        mock_metrics: mock.MagicMock,
        mock_produce_occurrence_to_kafka: mock.MagicMock,
    ) -> None:
        detector, _ = self.create_detector_and_condition(type=self.handler_state_type.slug)
        data_packet = DataPacket("1", {"dedupe": 2, "group_vals": {None: 6}})
        process_detectors(data_packet, [detector])

        build_mock_occurrence_and_event(detector.detector_handler, None, PriorityLevel.HIGH)

        data_packet = DataPacket("1", {"dedupe": 3, "group_vals": {None: 0}})
        result = DetectorEvaluationResult(
            group_key=None,
            is_triggered=False,
            priority=DetectorPriorityLevel.OK,
            result=StatusChangeMessage(
                fingerprint=[f"detector:{detector.id}"],
                project_id=self.project.id,
                new_status=GroupStatus.RESOLVED,
                new_substatus=None,
                id=str(self.mock_uuid4.return_value),
            ),
            event_data=None,
        )
        results = process_detectors(data_packet, [detector])
        assert results == [(detector, {result.group_key: result})]
        mock_metrics.incr.assert_has_calls(
            [
                call(
                    "workflow_engine.process_detector.resolved",
                    tags={"detector_type": detector.type},
                ),
            ],
        )
        assert mock_logger.info.call_count == 2
        assert mock_logger.info.call_args[0][0] == "detector_resolved"

    def test_doesnt_send_metric(self) -> None:
        detector = self.create_detector(type=self.no_handler_type.slug)
        data_packet = self.build_data_packet()

        with mock.patch("sentry.utils.metrics.incr") as mock_incr:
            with pytest.raises(ValueError):
                process_detectors(data_packet, [detector])

                calls = mock_incr.call_args_list
                # We can have background threads emitting metrics as tasks are scheduled
                filtered_calls = list(filter(lambda c: "taskworker" not in c.args[0], calls))
                assert len(filtered_calls) == 0


@django_db_all
class TestKeyBuilders(unittest.TestCase):
    def build_handler(self, detector: Detector | None = None) -> MockDetectorStateHandler:
        if detector is None:
            detector = Detector(id=123)
        return MockDetectorStateHandler(detector)

    def test(self) -> None:
        assert (
            self.build_handler().state_manager.build_key("test", "dedupe_value")
            == "detector:123:test:dedupe_value"
        )
        assert (
            self.build_handler().state_manager.build_key("test", "name_1")
            == "detector:123:test:name_1"
        )

    def test_different_dedupe_keys(self) -> None:
        handler = self.build_handler()
        handler_2 = self.build_handler(Detector(id=456))
        assert handler.state_manager.build_key(
            "test", "dedupe_value"
        ) != handler_2.state_manager.build_key("test", "dedupe_value")
        assert handler.state_manager.build_key(
            "test", "dedupe_value"
        ) != handler_2.state_manager.build_key("test2", "dedupe_value")
        assert handler.state_manager.build_key(
            "test", "dedupe_value"
        ) == handler.state_manager.build_key("test", "dedupe_value")
        assert handler.state_manager.build_key(
            "test", "dedupe_value"
        ) != handler.state_manager.build_key("test_2", "dedupe_value")

    def test_different_counter_value_keys(self) -> None:
        handler = self.build_handler()
        handler_2 = self.build_handler(Detector(id=456))
        assert handler.state_manager.build_key(
            "test", "name_1"
        ) != handler_2.state_manager.build_key("test", "name_1")
        assert handler.state_manager.build_key("test", "name_1") == handler.state_manager.build_key(
            "test", "name_1"
        )
        assert handler.state_manager.build_key("test", "name_1") != handler.state_manager.build_key(
            "test2", "name_1"
        )
        assert handler.state_manager.build_key("test", "name_1") != handler.state_manager.build_key(
            "test", "name_2"
        )
        assert handler.state_manager.build_key("test", "name_1") != handler.state_manager.build_key(
            "test2", "name_2"
        )


class TestGetStateData(BaseDetectorHandlerTest):
    def test_new(self) -> None:
        handler = self.build_handler()
        key = "test_key"
        assert handler.state_manager.get_state_data([key]) == {
            key: DetectorStateData(
                group_key=key,
                is_triggered=False,
                status=DetectorPriorityLevel.OK,
                dedupe_value=0,
                counter_updates={level: None for level in handler._thresholds},
            )
        }

    def test_existing(self) -> None:
        handler = self.build_handler()
        key = "test_key"
        state_data = DetectorStateData(
            group_key=key,
            is_triggered=True,
            status=DetectorPriorityLevel.OK,
            dedupe_value=10,
            counter_updates={
                **{level: None for level in handler._thresholds},
                DetectorPriorityLevel.HIGH: 1,
            },
        )
        handler.state_manager.enqueue_dedupe_update(state_data.group_key, state_data.dedupe_value)
        handler.state_manager.enqueue_counter_update(
            state_data.group_key, state_data.counter_updates
        )
        handler.state_manager.enqueue_state_update(
            state_data.group_key, state_data.is_triggered, state_data.status
        )
        handler.state_manager.commit_state_updates()
        assert handler.state_manager.get_state_data([key]) == {key: state_data}

    def test_multi(self) -> None:
        handler = self.build_handler()
        key_1 = "test_key_1"
        state_data_1 = DetectorStateData(
            group_key=key_1,
            is_triggered=True,
            status=DetectorPriorityLevel.OK,
            dedupe_value=100,
            counter_updates={
                **{level: None for level in handler._thresholds},
                DetectorPriorityLevel.OK: 5,
            },
        )
        handler.state_manager.enqueue_dedupe_update(key_1, state_data_1.dedupe_value)
        handler.state_manager.enqueue_counter_update(key_1, state_data_1.counter_updates)
        handler.state_manager.enqueue_state_update(
            key_1, state_data_1.is_triggered, state_data_1.status
        )

        key_2 = "test_key_2"
        state_data_2 = DetectorStateData(
            group_key=key_2,
            is_triggered=True,
            status=DetectorPriorityLevel.OK,
            dedupe_value=10,
            counter_updates={
                **{level: None for level in handler._thresholds},
                DetectorPriorityLevel.HIGH: 5,
            },
        )
        handler.state_manager.enqueue_dedupe_update(key_2, state_data_2.dedupe_value)
        handler.state_manager.enqueue_counter_update(key_2, state_data_2.counter_updates)
        handler.state_manager.enqueue_state_update(
            key_2, state_data_2.is_triggered, state_data_2.status
        )

        key_uncommitted = "test_key_uncommitted"
        state_data_uncommitted = DetectorStateData(
            group_key=key_uncommitted,
            is_triggered=False,
            status=DetectorPriorityLevel.OK,
            dedupe_value=0,
            counter_updates={level: None for level in handler._thresholds},
        )
        handler.state_manager.commit_state_updates()
        assert handler.state_manager.get_state_data([key_1, key_2, key_uncommitted]) == {
            key_1: state_data_1,
            key_2: state_data_2,
            key_uncommitted: state_data_uncommitted,
        }


class TestCommitStateUpdateData(BaseDetectorHandlerTest):
    def test(self) -> None:
        handler = self.build_handler()
        redis = get_redis_client()
        group_key = None
        assert not DetectorState.objects.filter(
            detector=handler.detector, detector_group_key=group_key
        ).exists()
        dedupe_key = handler.state_manager.build_key(group_key, "dedupe_value")
        counter_key_1 = handler.state_manager.build_key(group_key, "some_counter")
        counter_key_2 = handler.state_manager.build_key(group_key, "another_counter")

        assert not redis.exists(dedupe_key)
        assert not redis.exists(counter_key_1)
        assert not redis.exists(counter_key_2)
        handler.state_manager.enqueue_dedupe_update(group_key, 100)
        handler.state_manager.enqueue_counter_update(
            group_key, {"some_counter": 1, "another_counter": 2}
        )
        handler.state_manager.enqueue_state_update(group_key, True, DetectorPriorityLevel.OK)
        handler.state_manager.commit_state_updates()
        assert DetectorState.objects.filter(
            detector=handler.detector,
            detector_group_key=group_key,
            is_triggered=True,
            state=DetectorPriorityLevel.OK,
        ).exists()
        assert redis.get(dedupe_key) == "100"
        assert redis.get(counter_key_1) == "1"
        assert redis.get(counter_key_2) == "2"

        handler.state_manager.enqueue_dedupe_update(group_key, 150)
        handler.state_manager.enqueue_counter_update(
            group_key, {"some_counter": None, "another_counter": 20}
        )
        handler.state_manager.enqueue_state_update(group_key, False, DetectorPriorityLevel.OK)
        handler.state_manager.commit_state_updates()
        assert DetectorState.objects.filter(
            detector=handler.detector,
            detector_group_key=group_key,
            is_triggered=False,
            state=DetectorPriorityLevel.OK,
        ).exists()
        assert redis.get(dedupe_key) == "150"
        assert not redis.exists(counter_key_1)
        assert redis.get(counter_key_2) == "20"


@freeze_time()
class TestEvaluate(BaseDetectorHandlerTest):
    def test(self) -> None:
        handler = self.build_handler()
        assert handler.evaluate(DataPacket("1", {"dedupe": 1})) == {}

        detector_occurrence, _ = build_mock_occurrence_and_event(
            handler, "val1", PriorityLevel.HIGH
        )

        issue_occurrence, event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=handler.detector,
            group_key="val1",
            value=6,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        assert handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 6}})) == {
            "val1": DetectorEvaluationResult(
                group_key="val1",
                is_triggered=True,
                priority=DetectorPriorityLevel.HIGH,
                result=issue_occurrence,
                event_data=event_data,
            )
        }

        self.assert_updates(
            handler,
            "val1",
            2,
            {
                **handler.test_get_empty_counter_state(),
                DetectorPriorityLevel.HIGH: 1,
            },
            True,
            DetectorPriorityLevel.HIGH,
        )

    def test_above_below_threshold(self) -> None:
        handler = self.build_handler()
        assert handler.evaluate(DataPacket("1", {"dedupe": 1, "group_vals": {"val1": 0}})) == {}

        detector_occurrence, _ = build_mock_occurrence_and_event(
            handler, "val1", PriorityLevel.HIGH
        )

        issue_occurrence, event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=handler.detector,
            group_key="val1",
            value=6,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        assert handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 6}})) == {
            "val1": DetectorEvaluationResult(
                group_key="val1",
                is_triggered=True,
                priority=DetectorPriorityLevel.HIGH,
                result=issue_occurrence,
                event_data=event_data,
            )
        }
        assert handler.evaluate(DataPacket("1", {"dedupe": 3, "group_vals": {"val1": 6}})) == {}
        assert handler.evaluate(DataPacket("1", {"dedupe": 4, "group_vals": {"val1": 0}})) == {
            "val1": DetectorEvaluationResult(
                group_key="val1",
                is_triggered=False,
                result=StatusChangeMessage(
                    fingerprint=[f"detector:{handler.detector.id}:val1"],
                    project_id=self.project.id,
                    new_status=1,
                    new_substatus=None,
                ),
                priority=DetectorPriorityLevel.OK,
            )
        }

    def test_no_condition_group(self) -> None:
        detector = self.create_detector(type=self.handler_type.slug)
        handler = MockDetectorStateHandler(detector)
        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.metrics"
        ) as mock_metrics:
            assert (
                handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 100}})) == {}
            )
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_invalid_condition_group"
            )
            self.assert_updates(handler, "val1", 2, None, None, None)

    def test_results_on_change(self) -> None:
        handler = self.build_handler()

        detector_occurrence, _ = build_mock_occurrence_and_event(
            handler, "val1", PriorityLevel.HIGH
        )

        issue_occurrence, event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=handler.detector,
            group_key="val1",
            value=100,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result = handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 100}}))

        assert result == {
            "val1": DetectorEvaluationResult(
                group_key="val1",
                is_triggered=True,
                priority=DetectorPriorityLevel.HIGH,
                result=issue_occurrence,
                event_data=event_data,
            )
        }
        self.assert_updates(
            handler,
            "val1",
            2,
            {
                **handler.test_get_empty_counter_state(),
                DetectorPriorityLevel.HIGH: 1,
            },
            True,
            DetectorPriorityLevel.HIGH,
        )
        # This detector is already triggered, so no status change occurred. Should be no result
        assert handler.evaluate(DataPacket("1", {"dedupe": 3, "group_vals": {"val1": 200}})) == {}

    def test_dedupe(self) -> None:
        handler = self.build_handler()

        detector_occurrence, _ = build_mock_occurrence_and_event(
            handler, "val1", PriorityLevel.HIGH
        )

        issue_occurrence, event_data = self.detector_to_issue_occurrence(
            detector_occurrence=detector_occurrence,
            detector=handler.detector,
            group_key="val1",
            value=8,
            priority=DetectorPriorityLevel.HIGH,
            occurrence_id=str(self.mock_uuid4.return_value),
        )

        result = handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 8}}))

        assert result == {
            "val1": DetectorEvaluationResult(
                group_key="val1",
                is_triggered=True,
                priority=DetectorPriorityLevel.HIGH,
                result=issue_occurrence,
                event_data=event_data,
            )
        }
        self.assert_updates(
            handler,
            "val1",
            2,
            {
                **handler.test_get_empty_counter_state(),
                DetectorPriorityLevel.HIGH: 1,
            },
            True,
            DetectorPriorityLevel.HIGH,
        )
        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.metrics"
        ) as mock_metrics:
            assert handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 0}})) == {}
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_already_processed_update"
            )
        self.assert_updates(
            handler,
            "val1",
            None,
            {
                **handler.test_get_empty_counter_state(),
                DetectorPriorityLevel.HIGH: 1,
            },
            None,
            None,
        )


@freeze_time()
class TestEvaluateGroupValue(BaseDetectorHandlerTest):
    def test_dedupe(self) -> None:
        handler = self.build_handler()
        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.metrics"
        ) as mock_metrics:
            detector_occurrence, _ = build_mock_occurrence_and_event(
                handler, "val1", PriorityLevel.HIGH
            )

            issue_occurrence, event_data = self.detector_to_issue_occurrence(
                detector_occurrence=detector_occurrence,
                detector=handler.detector,
                group_key="group_key",
                value=10,
                priority=DetectorPriorityLevel.HIGH,
                occurrence_id=str(self.mock_uuid4.return_value),
            )

            expected_result = DetectorEvaluationResult(
                "group_key",
                True,
                DetectorPriorityLevel.HIGH,
                result=issue_occurrence,
                event_data=event_data,
            )

            handler.state_manager.enqueue_state_update(
                "group_key",
                False,
                DetectorPriorityLevel.OK,
            )
            handler.state_manager.enqueue_dedupe_update("group_key", 99)
            handler.state_manager.commit_state_updates()

            data_packet = DataPacket[dict[str, Any]](
                source_id="1234",
                packet={"id": "1234", "group_vals": {"group_key": 10}, "dedupe": 100},
            )
            result = handler.evaluate(data_packet)
            if not result:
                raise AssertionError("Expected result to not be empty")

            assert result["group_key"] == expected_result
            assert not mock_metrics.incr.called

    def test_dedupe__already_processed(self) -> None:
        handler = self.build_handler()

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.metrics"
        ) as mock_metrics:
            handler.state_manager.enqueue_state_update(
                "group_key",
                False,
                DetectorPriorityLevel.OK,
            )

            handler.state_manager.enqueue_dedupe_update("group_key", 100)
            handler.state_manager.commit_state_updates()

            handler.evaluate(
                DataPacket[dict[str, Any]](
                    source_id="1234",
                    packet={"id": "1234", "group_vals": {"group_key": 10}, "dedupe": 100},
                ),
            )
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_already_processed_update"
            )

    def test_status_change(self) -> None:
        handler = self.build_handler()
        data_packet = DataPacket[dict[str, Any]](
            source_id="1234", packet={"id": "1234", "group_vals": {"group_key": 10}, "dedupe": 100}
        )

        assert handler.state_manager.get_state_data(["group_key"]) == {
            "group_key": DetectorStateData(
                group_key="group_key",
                is_triggered=False,
                status=DetectorPriorityLevel.OK,
                dedupe_value=0,
                counter_updates={level: None for level in handler._thresholds},
            )
        }

        handler.evaluate(data_packet)

        assert handler.state_manager.get_state_data(["group_key"]) == {
            "group_key": DetectorStateData(
                group_key="group_key",
                is_triggered=True,
                status=DetectorPriorityLevel.HIGH,
                dedupe_value=100,
                counter_updates={
                    **{level: None for level in handler._thresholds},
                    DetectorPriorityLevel.HIGH: 1,
                },
            )
        }


class TestGetDetectorsForEvent(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.group = self.create_group(project=self.project, type=MetricIssue.type_id)
        self.detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.issue_stream_detector = self.create_detector(
            project=self.project, type=IssueStreamGroupType.slug
        )
        self.event = self.store_event(project_id=self.project.id, data={})
        self.occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": self.detector.id},
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event = GroupEvent.from_event(self.event, self.group)

    def test_activity_update(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        event_data = WorkflowEventData(event=activity, group=self.group)
        result = get_detectors_for_event_data(event_data, detector=self.detector)
        assert result is not None
        assert result.preferred_detector == self.detector
        assert result.detectors == {self.issue_stream_detector, self.detector}

    def test_error_event(self) -> None:
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.error_detector
        assert result.detectors == {self.issue_stream_detector, self.error_detector}

    def test_metric_issue(self) -> None:
        self.group_event.occurrence = self.occurrence

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.detector
        assert result.detectors == {self.issue_stream_detector, self.detector}

    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_event_without_detector(self, mock_logger: MagicMock) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={},  # no detector id
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event.occurrence = occurrence

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.issue_stream_detector
        assert result.detectors == {self.issue_stream_detector}

        # assert no exception is logged
        mock_logger.exception.assert_not_called()

    @patch("sentry.workflow_engine.processors.detector.logger")
    def test_event_missing_detector(self, mock_logger: MagicMock) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": 12345},  # missing detector
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )
        self.group_event.occurrence = occurrence

        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is not None
        assert result.preferred_detector == self.issue_stream_detector
        assert result.detectors == {self.issue_stream_detector}

        # assert no exception is logged
        mock_logger.exception.assert_called_once()

    def test_no_detectors(self) -> None:
        self.issue_stream_detector.delete()
        self.error_detector.delete()
        event_data = WorkflowEventData(event=self.group_event, group=self.group)
        result = get_detectors_for_event_data(event_data)
        assert result is None

    def test_multiple_detectors(self) -> None:
        event_data = WorkflowEventData(event=self.group_event, group=self.group)

        # Default behavior: issue stream detector is included
        result = get_detectors_for_event_data(event_data)

        assert result is not None
        assert result.issue_stream_detector == self.issue_stream_detector
        assert result.event_detector == self.error_detector
        assert result.preferred_detector == self.error_detector


class TestGetPreferredDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project, type=MetricIssue.type_id)
        self.detector = self.create_detector(project=self.project, type=MetricIssue.slug)
        self.error_detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        self.event = self.store_event(project_id=self.project.id, data={})
        self.occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={"detector_id": self.detector.id},
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )

    def test_with_occurrence(self) -> None:
        group_event = GroupEvent.from_event(self.event, self.group)
        group_event.occurrence = self.occurrence

        event_data = WorkflowEventData(event=group_event, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.detector

    def test_without_occurrence(self) -> None:
        self.group.type = ErrorGroupType.type_id
        group_event = GroupEvent.from_event(self.event, self.group)
        group_event.occurrence = None

        event_data = WorkflowEventData(event=group_event, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.error_detector

    def test_activity(self) -> None:
        activity = Activity.objects.create(
            project=self.project,
            group=self.group,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )
        DetectorGroup.objects.create(detector=self.detector, group=self.group)

        event_data = WorkflowEventData(event=activity, group=self.group)

        result = get_preferred_detector(event_data)

        assert result == self.detector

    def test_no_detector_id(self) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=1,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={},
            evidence_display=[],
            type=MetricIssue,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )

        group_event = GroupEvent.from_event(self.event, self.group)
        group_event.occurrence = occurrence

        event_data = WorkflowEventData(event=group_event, group=self.group)

        with pytest.raises(Detector.DoesNotExist):
            get_preferred_detector(event_data)

    def test_errors_on_no_detector(self) -> None:
        occurrence = IssueOccurrence(
            id=uuid.uuid4().hex,
            project_id=self.project.id,
            event_id="asdf",
            fingerprint=["asdf"],
            issue_title="title",
            subtitle="subtitle",
            resource_id=None,
            evidence_data={},
            evidence_display=[],
            type=PerformanceNPlusOneAPICallsGroupType,
            detection_time=timezone.now(),
            level="error",
            culprit="",
        )

        group_event = GroupEvent.from_event(self.event, self.group)
        self.group.update(type=PerformanceNPlusOneAPICallsGroupType.type_id)
        group_event.occurrence = occurrence

        event_data = WorkflowEventData(event=group_event, group=self.group)

        with pytest.raises(Detector.DoesNotExist):
            get_preferred_detector(event_data)


class TestAssociateNewGroupWithDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.metric_detector = self.create_detector(project=self.project, type="metric_issue")
        self.error_detector = self.create_detector(project=self.project, type="error")

    def test_metrics_group_with_known_detector(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        # Should return True and create DetectorGroup
        assert associate_new_group_with_detector(group, self.metric_detector.id)
        assert DetectorGroup.objects.filter(
            detector_id=self.metric_detector.id, group_id=group.id
        ).exists()

    def test_error_group_with_feature_disabled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.associate_error_detectors": False}):
            assert not associate_new_group_with_detector(group)
            assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_error_group_with_feature_enabled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.associate_error_detectors": True}):
            assert associate_new_group_with_detector(group)
            assert DetectorGroup.objects.filter(
                detector_id=self.error_detector.id, group_id=group.id
            ).exists()

    def test_feedback_group_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)
        assert not associate_new_group_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_deleted_detector_creates_null_association(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        deleted_detector_id = self.metric_detector.id

        self.metric_detector.delete()

        assert associate_new_group_with_detector(group, deleted_detector_id)

        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id is None
        assert detector_group.group_id == group.id


class TestEnsureAssociationWithDetector(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.metric_detector = self.create_detector(project=self.project, type="metric_issue")
        self.error_detector = self.create_detector(project=self.project, type="error")
        self.options_context = self.options({"workflow_engine.ensure_detector_association": True})
        self.options_context.__enter__()

    def tearDown(self) -> None:
        self.options_context.__exit__(None, None, None)
        super().tearDown()

    def test_feature_disabled_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        with self.options({"workflow_engine.ensure_detector_association": False}):
            assert not ensure_association_with_detector(group)
            assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_already_exists_returns_true(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        DetectorGroup.objects.create(detector=self.error_detector, group=group)

        assert ensure_association_with_detector(group)
        assert DetectorGroup.objects.filter(group_id=group.id).count() == 1

    def test_error_group_creates_association(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id == self.error_detector.id
        assert detector_group.group_id == group.id

    def test_metric_group_with_detector_id(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)

        assert ensure_association_with_detector(group, self.metric_detector.id)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id == self.metric_detector.id
        assert detector_group.group_id == group.id

    def test_feedback_group_returns_false(self) -> None:
        group = self.create_group(project=self.project, type=FeedbackGroup.type_id)

        assert not ensure_association_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()

    def test_deleted_detector_creates_null_association(self) -> None:
        group = self.create_group(project=self.project, type=MetricIssue.type_id)
        deleted_detector_id = self.metric_detector.id

        self.metric_detector.delete()

        assert ensure_association_with_detector(group, deleted_detector_id)

        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.detector_id is None
        assert detector_group.group_id == group.id

    def test_backdates_date_added_to_group_first_seen(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        detector_group = DetectorGroup.objects.get(group_id=group.id)
        assert detector_group.date_added == group.first_seen

    def test_race_condition_handled(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        assert ensure_association_with_detector(group)
        assert ensure_association_with_detector(group)
        assert DetectorGroup.objects.filter(group_id=group.id).count() == 1

    def test_detector_not_found(self) -> None:
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        self.error_detector.delete()

        assert not ensure_association_with_detector(group)
        assert not DetectorGroup.objects.filter(group_id=group.id).exists()
