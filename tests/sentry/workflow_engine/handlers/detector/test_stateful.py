from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.detector.test_base import MockDetectorStateHandler

Level = DetectorPriorityLevel


class TestStatefulDetectorHandler(TestCase):
    def setUp(self):
        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

    def test__init_creates_default_thresholds(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        # Only the OK threshold is set by default
        assert handler._thresholds == {Level.OK: 1}

    def test_init__override_thresholds(self):
        handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={Level.LOW: 2},
        )

        # Setting the thresholds on the detector allow to override the defaults
        assert handler._thresholds == {Level.OK: 1, Level.LOW: 2}

    def test_init__creates_correct_state_counters(self):
        handler = MockDetectorStateHandler(detector=self.detector)
        assert handler.state_manager.counter_names == [Level.OK]


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
                Level.HIGH: 2,
            },
        )

    def test_increment_detector_thresholds(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(state, Level.HIGH, self.group_key)
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Default to all states since the detector is not configured with any.
        assert updated_state.counter_updates == {
            **{level: 1 for level in self.handler._thresholds},
            Level.OK: None,
        }

    def test_increment_detector_thresholds__medium(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(state, Level.MEDIUM, self.group_key)
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # All states, lower than high, should be incremented by 1, except for OK
        assert updated_state.counter_updates == {
            Level.HIGH: None,
            Level.OK: None,
        }

    def test_increment_detector_thresholds_low(self):
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(state, Level.LOW, self.group_key)
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # The detector doesn't increment LOW because it's not configured
        assert updated_state.counter_updates == {
            Level.OK: None,
            Level.HIGH: None,
        }


class TestStatefulDetectorHandlerEvaluate(TestCase):
    def setUp(self):
        self.group_key: DetectorGroupKey = None

        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )
        self.detector.workflow_condition_group = self.create_data_condition_group()

        def add_condition(val: str, result: DetectorPriorityLevel):
            self.create_data_condition(
                type="eq",
                comparison=val,
                condition_group=self.detector.workflow_condition_group,
                condition_result=result,
            )

        # Setup conditions for each priority level
        add_condition(val="OK", result=Level.OK)
        add_condition(val="LOW", result=Level.LOW)
        add_condition(val="MEDIUM", result=Level.MEDIUM)
        add_condition(val="HIGH", result=Level.HIGH)

        self.handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                Level.LOW: 2,
                Level.MEDIUM: 2,
                Level.HIGH: 2,
            },
        )

    def packet(self, key: int, result: DetectorPriorityLevel):
        """
        Constructs a test data packet that will evaluate to the
        DetectorPriorityLevel specified for the result parameter.

        See the `add_condition` to understand the priority level -> group value
        mappings.
        """
        packet = {
            "id": str(key),
            "dedupe": key,
            "group_vals": {self.group_key: result.name},
        }
        return DataPacket(source_id=str(key), packet=packet)

    def test_evaualte__under_threshold(self):
        # First evaluation does not trigger the threshold
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        assert result == {}

    def test_evaluate__override_threshold__triggered(self):
        # First evaluation does not trigger the threshold
        self.handler.evaluate(self.packet(1, Level.HIGH))

        # Second evaluation surpasses threshold and triggers
        result = self.handler.evaluate(self.packet(2, Level.HIGH))
        assert result
        evaluation_result = result[self.group_key]

        assert evaluation_result
        assert evaluation_result.priority == Level.HIGH
        assert isinstance(evaluation_result.result, IssueOccurrence)

        evidence_data = evaluation_result.result.evidence_data
        assert evidence_data["detector_id"] == self.detector.id

    def test_evaluate__detector_state(self):
        # Two evaluations triggers threshold
        self.handler.evaluate(self.packet(1, Level.HIGH))
        self.handler.evaluate(self.packet(2, Level.HIGH))

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        assert state_data.is_triggered is True
        assert state_data.status == Level.HIGH

        # Only has configured states
        assert state_data.counter_updates == {
            Level.HIGH: 2,
            Level.MEDIUM: 2,
            Level.LOW: 2,
            Level.OK: None,
        }

    def test_evaluate__detector_state__all_levels(self):
        # A single HIGH evaluation should increment all levels
        self.handler.evaluate(self.packet(1, Level.HIGH))
        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Verify all the levels are present now
        assert state_data.counter_updates == {
            **{level: 1 for level in Level},
            Level.OK: None,
        }

    def test_evaluate__resolves(self):
        # Two HIGH evaluations will trigger
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        result = self.handler.evaluate(self.packet(2, Level.HIGH))
        assert result.get(self.group_key)
        assert isinstance(result[self.group_key].result, IssueOccurrence)

        # Resolves after a OK packet
        result = self.handler.evaluate(self.packet(3, Level.OK))
        assert result.get(self.group_key)
        evaluation_result = result[self.group_key]

        assert isinstance(evaluation_result.result, StatusChangeMessage)
        assert evaluation_result.priority == Level.OK
        assert evaluation_result.result.detector_id == self.detector.id

    def test_evaluate__resolve__detector_state(self):
        # Two HIGH evaluations will trigger
        self.handler.evaluate(self.packet(1, Level.HIGH))
        self.handler.evaluate(self.packet(2, Level.HIGH))
        # A final OK will resolve
        self.handler.evaluate(self.packet(3, Level.OK))

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Check that the state is reset
        assert state_data.is_triggered is False
        assert state_data.status == Level.OK
        # Only has configured states
        assert state_data.counter_updates == {
            **{level: None for level in self.handler._thresholds},
        }

    def test_evaluate__trigger_after_resolve(self):
        # Two HIGH evaluations will trigger
        self.handler.evaluate(self.packet(1, Level.HIGH))
        self.handler.evaluate(self.packet(2, Level.HIGH))
        # A final OK will resolve
        self.handler.evaluate(self.packet(3, Level.OK))

        # Evaluate again, but under threshold so no trigger
        result = self.handler.evaluate(self.packet(4, Level.HIGH))
        assert result == {}

        # Evaluate again and cause a trigger
        result = self.handler.evaluate(self.packet(5, Level.HIGH))
        assert result
        evaluation_result = result[self.group_key]

        assert evaluation_result
        assert evaluation_result.priority == Level.HIGH
        assert isinstance(evaluation_result.result, IssueOccurrence)

    def test_evaluate__trigger_after_resolve__detector_state(self):
        # Two HIGH evaluations will trigger
        self.handler.evaluate(self.packet(1, Level.HIGH))
        self.handler.evaluate(self.packet(2, Level.HIGH))
        # A final OK will resolve
        self.handler.evaluate(self.packet(3, Level.OK))

        # Evaluate again, but under threshold so no trigger
        self.handler.evaluate(self.packet(4, Level.HIGH))

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert self.handler._thresholds[Level.HIGH] == 2
        assert state_data.is_triggered is False

        # Evaluate again and cause a trigger
        self.handler.evaluate(self.packet(5, Level.HIGH))

        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert state_data.is_triggered is True
        assert state_data.status == Level.HIGH
