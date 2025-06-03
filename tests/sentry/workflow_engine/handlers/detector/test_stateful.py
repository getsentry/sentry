from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.detector.test_base import MockDetectorStateHandler


class TestStatefulDetectorHandler(TestCase):
    def setUp(self):
        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

    def test__init_creates_default_thresholds(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        # Only the OK threshold is set by default
        assert handler._thresholds == {DetectorPriorityLevel.OK: 1}

    def test_init__override_thresholds(self):
        handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                DetectorPriorityLevel.LOW: 2,
            },
        )

        # Setting the thresholds on the detector allow to override the defaults
        assert handler._thresholds == {
            DetectorPriorityLevel.OK: 1,
            DetectorPriorityLevel.LOW: 2,
        }

    def test_init__creates_correct_state_counters(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        assert handler.state_manager.counter_names == [DetectorPriorityLevel.OK]


class TestStatefulDetectorIncrementThresholds(TestCase):
    def setUp(self):
        self.group_key: DetectorGroupKey = None
        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

        self.handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                DetectorPriorityLevel.HIGH: 2,
            },
        )

    def test_increment_detector_thresholds(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(
            state, DetectorPriorityLevel.HIGH, self.group_key
        )
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Default to all states since the detector is not configured with any.
        assert updated_state.counter_updates == {
            **{level: 1 for level in self.handler._thresholds},
            DetectorPriorityLevel.OK: None,
        }

    def test_increment_detector_thresholds__medium(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(
            state, DetectorPriorityLevel.MEDIUM, self.group_key
        )
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # All states, lower than high, should be incremented by 1, except for OK
        assert updated_state.counter_updates == {
            DetectorPriorityLevel.HIGH: None,
            DetectorPriorityLevel.OK: None,
        }

    def test_increment_detector_thresholds_low(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(
            state, DetectorPriorityLevel.LOW, self.group_key
        )
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # The detector doesn't increment LOW because it's not configured
        assert updated_state.counter_updates == {
            DetectorPriorityLevel.OK: None,
            DetectorPriorityLevel.HIGH: None,
        }


class TestStatefulDetectorHandlerEvaluate(TestCase):
    def setUp(self):
        self.group_key: DetectorGroupKey = None

        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )
        self.detector.workflow_condition_group = self.create_data_condition_group()

        # Setting a trigger condition on the detector allows to override the default OK threshold
        self.create_data_condition(
            type="gte",
            comparison=0,
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        self.handler = MockDetectorStateHandler(
            detector=self.detector, thresholds={DetectorPriorityLevel.HIGH: 2}
        )

        self.data_packet = DataPacket(
            source_id="1",
            packet={
                "id": "1",
                "group_vals": {self.group_key: 1},
                "dedupe": 1,
            },
        )

        self.data_packet_two = DataPacket(
            source_id="2",
            packet={
                "id": "2",
                "group_vals": {self.group_key: 1},
                "dedupe": 2,
            },
        )

        self.resolve_data_packet = DataPacket(
            source_id="3",
            packet={
                "id": "3",
                "group_vals": {self.group_key: -1},
                "dedupe": 3,
            },
        )

    def test_evaualte__override_threshold(self):
        result = self.handler.evaluate(self.data_packet)
        assert result == {}

    def test_evaluate__override_threshold__triggered(self):
        self.handler.evaluate(self.data_packet)
        result = self.handler.evaluate(self.data_packet_two)

        assert result
        evaluation_result = result[self.group_key]

        assert evaluation_result
        assert evaluation_result.priority == DetectorPriorityLevel.HIGH
        assert isinstance(evaluation_result.result, IssueOccurrence)

        evidence_data = evaluation_result.result.evidence_data
        assert evidence_data["detector_id"] == self.detector.id

    def test_evaluate__detector_state(self):
        self.handler.evaluate(self.data_packet)
        self.handler.evaluate(self.data_packet_two)

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        assert state_data.is_triggered is True
        assert state_data.status == DetectorPriorityLevel.HIGH

        # Only has configured states
        assert state_data.counter_updates == {
            DetectorPriorityLevel.HIGH: 2,
            DetectorPriorityLevel.OK: None,
        }

    def test_evaluate__detector_state__all_levels(self):
        # Add additional levels to the detector
        self.create_data_condition(
            type="gte",
            comparison=0,
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.LOW,
        )

        self.create_data_condition(
            type="gte",
            comparison=0,
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.MEDIUM,
        )

        # Reinitialize the handler to include the new levels
        self.handler = MockDetectorStateHandler(
            detector=self.detector, thresholds={DetectorPriorityLevel.HIGH: 2}
        )

        self.handler.evaluate(self.data_packet)
        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Verify all the levels are present now
        assert state_data.counter_updates == {
            **{level: 1 for level in DetectorPriorityLevel},
            DetectorPriorityLevel.OK: None,
        }

    def test_evaluate__resolve(self):
        self.handler.evaluate(self.data_packet)
        self.handler.evaluate(self.data_packet_two)
        result = self.handler.evaluate(self.resolve_data_packet)

        assert result
        evaluation_result = result[self.group_key]

        assert evaluation_result
        assert evaluation_result.priority == DetectorPriorityLevel.OK
        assert isinstance(evaluation_result.result, StatusChangeMessage)

    def test_evaluate__resolve__detector_state(self):
        self.handler.evaluate(self.data_packet)
        self.handler.evaluate(self.data_packet_two)
        self.handler.evaluate(self.resolve_data_packet)

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Check that the state is reset
        assert state_data.is_triggered is False
        assert state_data.status == DetectorPriorityLevel.OK
        # Only has configured states
        assert state_data.counter_updates == {
            **{level: None for level in self.handler._thresholds},
        }

    def test_evaluate__trigger_after_resolve(self):
        self.handler.evaluate(self.data_packet)
        self.handler.evaluate(self.data_packet_two)
        self.handler.evaluate(self.resolve_data_packet)

        # Trigger again
        assert self.handler._thresholds[DetectorPriorityLevel.HIGH] == 2
        self.data_packet.packet["dedupe"] = 4
        self.data_packet_two.packet["dedupe"] = 5
        result = self.handler.evaluate(self.data_packet)
        assert self.handler._thresholds[DetectorPriorityLevel.HIGH] == 2
        assert result == {}

        result = self.handler.evaluate(self.data_packet_two)

        assert result
        evaluation_result = result[self.group_key]

        assert evaluation_result
        assert evaluation_result.priority == DetectorPriorityLevel.HIGH
        assert isinstance(evaluation_result.result, IssueOccurrence)

    def test_evaluate__trigger_after_resolve__detector_state(self):
        self.handler.evaluate(self.data_packet)
        self.handler.evaluate(self.data_packet_two)
        self.handler.evaluate(self.resolve_data_packet)

        # Trigger again
        self.data_packet.packet["dedupe"] = 4
        self.data_packet_two.packet["dedupe"] = 5
        self.handler.evaluate(self.data_packet)
        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert self.handler._thresholds[DetectorPriorityLevel.HIGH] == 2
        assert state_data.is_triggered is False

        self.handler.evaluate(self.data_packet_two)

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert state_data.is_triggered is True
        assert state_data.status == DetectorPriorityLevel.HIGH
