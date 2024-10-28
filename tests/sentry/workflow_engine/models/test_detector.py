import unittest

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
    def evaluate(self, data_packet: DataPacket[dict]) -> list[DetectorEvaluationResult]:
        return []


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


class TestCommitStateUpdateData(TestCase):
    def setUp(self):
        super().setUp()

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
