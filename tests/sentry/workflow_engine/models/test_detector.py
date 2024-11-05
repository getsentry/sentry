import unittest
from unittest import mock

from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket, DetectorEvaluationResult
from sentry.workflow_engine.models.detector import (
    Detector,
    DetectorStateData,
    StatefulDetectorHandler,
    get_redis_client,
)
from sentry.workflow_engine.models.detector_state import DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel


class MockDetectorStateHandler(StatefulDetectorHandler[dict]):
    counter_names = ["test1", "test2"]

    def get_dedupe_value(self, data_packet: DataPacket[dict]) -> int:
        return data_packet.packet.get("dedupe", 0)

    def get_group_key_values(self, data_packet: DataPacket[dict]) -> dict[str, int]:
        return data_packet.packet.get("group_vals", {})


class TestKeyBuilders(unittest.TestCase):
    def build_handler(self, detector: Detector | None = None) -> MockDetectorStateHandler:
        if detector is None:
            detector = Detector(id=123)
        return MockDetectorStateHandler(detector)

    def test(self):
        assert self.build_handler().build_dedupe_value_key("test") == "123:test:dedupe_value"
        assert self.build_handler().build_counter_value_key("test", "name_1") == "123:test:name_1"

    def test_different_dedupe_keys(self):
        handler = self.build_handler()
        handler_2 = self.build_handler(Detector(id=456))
        assert handler.build_dedupe_value_key("test") != handler_2.build_dedupe_value_key("test")
        assert handler.build_dedupe_value_key("test") != handler_2.build_dedupe_value_key("test2")
        assert handler.build_dedupe_value_key("test") == handler.build_dedupe_value_key("test")
        assert handler.build_dedupe_value_key("test") != handler.build_dedupe_value_key("test_2")

    def test_different_counter_value_keys(self):
        handler = self.build_handler()
        handler_2 = self.build_handler(Detector(id=456))
        assert handler.build_counter_value_key(
            "test", "name_1"
        ) != handler_2.build_counter_value_key("test", "name_1")
        assert handler.build_counter_value_key("test", "name_1") == handler.build_counter_value_key(
            "test", "name_1"
        )
        assert handler.build_counter_value_key("test", "name_1") != handler.build_counter_value_key(
            "test2", "name_1"
        )
        assert handler.build_counter_value_key("test", "name_1") != handler.build_counter_value_key(
            "test", "name_2"
        )
        assert handler.build_counter_value_key("test", "name_1") != handler.build_counter_value_key(
            "test2", "name_2"
        )


class StatefulDetectorHandlerTestMixin(TestCase):
    __test__ = Abstract(__module__, __qualname__)

    def build_handler(self, detector: Detector | None = None) -> MockDetectorStateHandler:
        if detector is None:
            detector = self.create_detector(
                workflow_condition_group=self.create_data_condition_group()
            )
            self.create_data_condition(condition_group=detector.workflow_condition_group)
        return MockDetectorStateHandler(detector)


class TestGetStateData(StatefulDetectorHandlerTestMixin):
    def test_new(self):
        handler = self.build_handler()
        key = "test_key"
        assert handler.get_state_data([key]) == {
            key: DetectorStateData(
                key, False, DetectorPriorityLevel.OK, 0, {"test1": None, "test2": None}
            )
        }

    def test_existing(self):
        handler = self.build_handler()
        key = "test_key"
        state_data = DetectorStateData(
            key, True, DetectorPriorityLevel.OK, 10, {"test1": 5, "test2": 200}
        )
        handler.commit_state_update_data([state_data])
        assert handler.get_state_data([key]) == {key: state_data}

    def test_multi(self):
        handler = self.build_handler()
        key_1 = "test_key_1"
        state_data_1 = DetectorStateData(
            key_1, True, DetectorPriorityLevel.OK, 100, {"test1": 50, "test2": 300}
        )
        key_2 = "test_key_2"
        state_data_2 = DetectorStateData(
            key_2, True, DetectorPriorityLevel.OK, 10, {"test1": 55, "test2": 12}
        )
        key_uncommitted = "test_key_uncommitted"
        state_data_uncommitted = DetectorStateData(
            key_uncommitted, False, DetectorPriorityLevel.OK, 0, {"test1": None, "test2": None}
        )
        handler.commit_state_update_data([state_data_1, state_data_2])
        assert handler.get_state_data([key_1, key_2, key_uncommitted]) == {
            key_1: state_data_1,
            key_2: state_data_2,
            key_uncommitted: state_data_uncommitted,
        }


class TestCommitStateUpdateData(StatefulDetectorHandlerTestMixin):
    def build_handler(self, detector: Detector | None = None) -> MockDetectorStateHandler:
        if detector is None:
            detector = self.create_detector()
        return MockDetectorStateHandler(detector)

    def test(self):
        handler = self.build_handler()
        redis = get_redis_client()
        group_key = None
        assert not DetectorState.objects.filter(
            detector=handler.detector, detector_group_key=group_key
        ).exists()
        dedupe_key = handler.build_dedupe_value_key(group_key)
        counter_key_1 = handler.build_counter_value_key(group_key, "some_counter")
        counter_key_2 = handler.build_counter_value_key(group_key, "another_counter")
        assert not redis.exists(dedupe_key)
        assert not redis.exists(counter_key_1)
        assert not redis.exists(counter_key_2)
        handler.commit_state_update_data(
            [
                DetectorStateData(
                    group_key,
                    True,
                    DetectorPriorityLevel.OK,
                    100,
                    {"some_counter": 1, "another_counter": 2},
                )
            ]
        )
        assert DetectorState.objects.filter(
            detector=handler.detector,
            detector_group_key=group_key,
            active=True,
            state=DetectorPriorityLevel.OK,
        ).exists()
        assert redis.get(dedupe_key) == "100"
        assert redis.get(counter_key_1) == "1"
        assert redis.get(counter_key_2) == "2"

        handler.commit_state_update_data(
            [
                DetectorStateData(
                    group_key,
                    False,
                    DetectorPriorityLevel.OK,
                    150,
                    {"some_counter": None, "another_counter": 20},
                )
            ]
        )
        assert DetectorState.objects.filter(
            detector=handler.detector,
            detector_group_key=group_key,
            active=False,
            state=DetectorPriorityLevel.OK,
        ).exists()
        assert redis.get(dedupe_key) == "150"
        assert not redis.exists(counter_key_1)
        assert redis.get(counter_key_2) == "20"


class TestEvaluate(StatefulDetectorHandlerTestMixin):
    def test(self):
        handler = self.build_handler()
        assert handler.evaluate(DataPacket("1", {"dedupe": 1})) == []
        assert handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 0}})) == [
            DetectorEvaluationResult(
                is_active=True,
                priority=DetectorPriorityLevel.HIGH,
                data={},
                state_update_data=DetectorStateData(
                    group_key="val1",
                    active=True,
                    status=DetectorPriorityLevel.HIGH,
                    dedupe_value=2,
                    counter_updates={},
                ),
            )
        ]

    def test_no_condition_group(self):
        detector = self.create_detector()
        handler = MockDetectorStateHandler(detector)
        with mock.patch("sentry.workflow_engine.models.detector.metrics") as mock_metrics:
            assert (
                handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 100}})) == []
            )
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_invalid_condition_group"
            )

    def test_results_on_change(self):
        handler = self.build_handler()
        result = handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 100}}))
        assert result == [
            DetectorEvaluationResult(
                is_active=True,
                priority=DetectorPriorityLevel.HIGH,
                data={},
                state_update_data=DetectorStateData(
                    group_key="val1",
                    active=True,
                    status=DetectorPriorityLevel.HIGH,
                    dedupe_value=2,
                    counter_updates={},
                ),
            )
        ]
        assert result[0].state_update_data
        handler.commit_state_update_data([result[0].state_update_data])
        # This detector is already active, so no status change occurred. Should be no result
        assert handler.evaluate(DataPacket("1", {"dedupe": 3, "group_vals": {"val1": 200}})) == []

    def test_dedupe(self):
        handler = self.build_handler()
        result = handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 0}}))
        assert result == [
            DetectorEvaluationResult(
                is_active=True,
                priority=DetectorPriorityLevel.HIGH,
                data={},
                state_update_data=DetectorStateData(
                    group_key="val1",
                    active=True,
                    status=DetectorPriorityLevel.HIGH,
                    dedupe_value=2,
                    counter_updates={},
                ),
            )
        ]
        handler.commit_state_update_data(
            [r.state_update_data for r in result if r.state_update_data]
        )
        with mock.patch("sentry.workflow_engine.models.detector.metrics") as mock_metrics:
            assert handler.evaluate(DataPacket("1", {"dedupe": 2, "group_vals": {"val1": 0}})) == []
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_already_processed_update"
            )


class TestEvaluateGroupKeyValue(StatefulDetectorHandlerTestMixin):
    def test_dedupe(self):
        handler = self.build_handler()
        with mock.patch("sentry.workflow_engine.models.detector.metrics") as mock_metrics:
            expected_result = DetectorEvaluationResult(
                True,
                DetectorPriorityLevel.HIGH,
                {},
                DetectorStateData(
                    "group_key",
                    True,
                    DetectorPriorityLevel.HIGH,
                    100,
                    {},
                ),
            )
            assert expected_result.state_update_data
            assert (
                handler.evaluate_group_key_value(
                    expected_result.state_update_data.group_key,
                    1,
                    DetectorStateData(
                        "group_key",
                        False,
                        DetectorPriorityLevel.OK,
                        99,
                        {},
                    ),
                    dedupe_value=100,
                )
                == expected_result
            )
            assert not mock_metrics.incr.called
            assert expected_result.state_update_data
            assert (
                handler.evaluate_group_key_value(
                    expected_result.state_update_data.group_key,
                    1,
                    DetectorStateData(
                        "group_key",
                        False,
                        DetectorPriorityLevel.OK,
                        100,
                        {},
                    ),
                    dedupe_value=100,
                )
                is None
            )
            mock_metrics.incr.assert_called_once_with(
                "workflow_engine.detector.skipping_already_processed_update"
            )
