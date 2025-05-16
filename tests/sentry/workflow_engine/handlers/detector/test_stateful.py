from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.detector.test_base import MockDetectorStateHandler


class TestStatefulDetectorHandler(TestCase):
    def setUp(self):
        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

    def test__init_creates_default_thresholds(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        assert handler._thresholds == {
            DetectorPriorityLevel.HIGH: 1,
            DetectorPriorityLevel.MEDIUM: 1,
            DetectorPriorityLevel.LOW: 1,
            DetectorPriorityLevel.OK: 1,
        }

    def test_init__override_thresholds(self):
        handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                DetectorPriorityLevel.HIGH: 1,
                DetectorPriorityLevel.LOW: 2,
                DetectorPriorityLevel.OK: 1,
            },
        )

        assert handler._thresholds == {
            DetectorPriorityLevel.HIGH: 1,
            DetectorPriorityLevel.MEDIUM: 1,
            DetectorPriorityLevel.LOW: 2,
            DetectorPriorityLevel.OK: 1,
        }

    def test_init__creates_correct_state_counters(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        assert handler.state_manager.counter_names == [
            DetectorPriorityLevel.OK,
            DetectorPriorityLevel.LOW,
            DetectorPriorityLevel.MEDIUM,
            DetectorPriorityLevel.HIGH,
        ]

    def test_evaluate__counters_increment(self):
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            type="gte",
            comparison=0,
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        handler = MockDetectorStateHandler(
            detector=self.detector, thresholds={DetectorPriorityLevel.HIGH: 2}
        )
        data_packet = DataPacket(
            source_id="1",
            packet={
                "id": "1",
                "group_vals": {None: 1},
                "dedupe": 1,
            },
        )
        result = handler.evaluate(data_packet)
        assert result == {}

        data_packet_two = DataPacket(
            source_id="2",
            packet={
                "id": "2",
                "group_vals": {None: 1},
                "dedupe": 2,
            },
        )
        result = handler.evaluate(data_packet_two)
        import pdb

        pdb.set_trace()
        assert result == {}  # TODO this should be a detector result
