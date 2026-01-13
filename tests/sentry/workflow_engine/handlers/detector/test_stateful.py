import unittest.mock as mock

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.types import (
    DataConditionResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)
from tests.sentry.workflow_engine.handlers.detector.test_base import MockDetectorStateHandler

Level = DetectorPriorityLevel


class TestStatefulDetectorHandler(TestCase):
    def setUp(self) -> None:
        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

    def _get_full_detector(self) -> Detector:
        """
        Fetches the full detector with its workflow condition group and conditions.
        This is useful to ensure that the detector is fully populated for testing.
        """
        detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert detector is not None
        return detector

    def test__init_creates_default_thresholds(self) -> None:
        handler = MockDetectorStateHandler(detector=self.detector)
        # Only the OK threshold is set by default
        assert handler._thresholds == {Level.OK: 1}

    def test_init__override_thresholds(self) -> None:
        handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={Level.LOW: 2},
        )

        # Setting the thresholds on the detector allow to override the defaults
        assert handler._thresholds == {Level.OK: 1, Level.LOW: 2}

    def test_init__creates_correct_state_counters(self) -> None:
        handler = MockDetectorStateHandler(detector=self.detector)
        assert handler.state_manager.counter_names == [Level.OK]

    def test_init__threshold_query(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=Level.HIGH,
        )

        fetched_detector = self._get_full_detector()

        with self.assertNumQueries(0):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1, Level.HIGH: 1}

    def test_init__threshold_query_no_conditions(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        fetched_detector = self._get_full_detector()

        with self.assertNumQueries(0):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1}

    def test_init__threshold_makes_query(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=Level.HIGH,
        )

        fetched_detector = Detector.objects.get(id=self.detector.id)

        with self.assertNumQueries(1):
            # Should make a query since we don't know the detector conditions
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1, Level.HIGH: 1}

    def test_init__handles_invalid_condition_result(self) -> None:
        """Test that invalid condition_result values are skipped gracefully."""
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        # Create a condition with a valid condition_result
        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=Level.HIGH,
        )

        # Create a condition with an invalid condition_result (not a valid DetectorPriorityLevel)
        self.create_data_condition(
            type="eq",
            comparison="INVALID",
            condition_group=self.detector.workflow_condition_group,
            condition_result=1,  # Invalid - not a valid DetectorPriorityLevel enum value
        )

        fetched_detector = self._get_full_detector()

        # Should not crash and only use the valid condition
        with self.assertNumQueries(0):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            # Only HIGH level should be present, invalid condition should be skipped
            assert handler._thresholds == {Level.OK: 1, Level.HIGH: 1}


class TestStatefulDetectorIncrementThresholds(TestCase):
    def setUp(self) -> None:
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

    def test_increment_detector_thresholds(self) -> None:
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(state, Level.HIGH, self.group_key)
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Default to all states since the detector is not configured with any.
        assert updated_state.counter_updates == {
            **{level: 1 for level in self.handler._thresholds},
            Level.OK: None,
        }

    def test_increment_detector_thresholds__medium(self) -> None:
        state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]
        self.handler._increment_detector_thresholds(state, Level.MEDIUM, self.group_key)
        self.handler.state_manager.commit_state_updates()
        updated_state = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # All states, lower than high, should be incremented by 1, except for OK
        assert updated_state.counter_updates == {
            Level.HIGH: None,
            Level.OK: None,
        }

    def test_increment_detector_thresholds_low(self) -> None:
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
    def setUp(self) -> None:
        self.group_key: DetectorGroupKey = None

        self.detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )
        self.detector.workflow_condition_group = self.create_data_condition_group()

        def add_condition(
            val: str | int,
            result: DetectorPriorityLevel,
            condition_type: str = "eq",
        ) -> None:
            self.create_data_condition(
                type=condition_type,
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

    def packet(self, key: int, result: DataConditionResult | str) -> DataPacket:
        """
        Constructs a test data packet that will evaluate to the
        DetectorPriorityLevel specified for the result parameter.

        See the `add_condition` to understand the priority level -> group value
        mappings.
        """
        value = result
        if isinstance(result, DetectorPriorityLevel):
            value = result.name

        packet = {
            "id": str(key),
            "dedupe": key,
            "group_vals": {self.group_key: value},
        }
        return DataPacket(source_id=str(key), packet=packet)

    def test_evaualte__under_threshold(self) -> None:
        # First evaluation does not trigger the threshold
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        assert result == {}

    def test_evaluate__override_threshold__triggered(self) -> None:
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

    def test_evaluate__detector_state(self) -> None:
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

    def test_evaluate__detector_state__all_levels(self) -> None:
        # A single HIGH evaluation should increment all levels
        self.handler.evaluate(self.packet(1, Level.HIGH))
        state_data = self.handler.state_manager.get_state_data([self.group_key])[self.group_key]

        # Verify all the levels are present now
        assert state_data.counter_updates == {
            **{level: 1 for level in Level},
            Level.OK: None,
        }

    def test_evaluate__resolves(self) -> None:
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

    def test_evaluate__high_to_low(self) -> None:
        # One HIGH then one LOW will result in a low evaluation
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        assert result == {}
        result = self.handler.evaluate(self.packet(2, Level.LOW))
        assert result.get(self.group_key)
        evaluation_result = result[self.group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        assert evaluation_result.priority == Level.LOW

    def test_evaluate__low_to_high(self) -> None:
        # Two LOW evaluations result in a LOW
        result = self.handler.evaluate(self.packet(1, Level.LOW))
        result = self.handler.evaluate(self.packet(2, Level.LOW))
        assert result.get(self.group_key)
        evaluation_result = result[self.group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        assert evaluation_result.priority == Level.LOW

        # Followed by two HIGH evaluations to result in a high
        result = self.handler.evaluate(self.packet(3, Level.HIGH))
        assert result == {}
        result = self.handler.evaluate(self.packet(4, Level.HIGH))
        assert result.get(self.group_key)
        evaluation_result = result[self.group_key]
        assert isinstance(evaluation_result.result, IssueOccurrence)
        assert evaluation_result.priority == Level.HIGH

    def test_evaluate__resolve__detector_state(self) -> None:
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

    def test_evaluate__trigger_after_resolve(self) -> None:
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

    def test_evaluate__trigger_after_resolve__detector_state(self) -> None:
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

    def test_evaluate__ok_resets_counters(self) -> None:
        # This should NOT trigger for HIGH since there's an OK in-between
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        result = self.handler.evaluate(self.packet(2, Level.OK))
        result = self.handler.evaluate(self.packet(3, Level.HIGH))

        assert result == {}

    def test_evaluate__low_threshold_larger_than_high(self) -> None:
        """
        Test that a LOW threshold that is larger than the HIGH threshold does
        not trigger once the HIGH threshold has already triggered.
        """
        test_handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                Level.LOW: 3,
                Level.MEDIUM: 2,
                Level.HIGH: 2,
            },
        )

        # First two trigger a high result
        result = test_handler.evaluate(self.packet(1, Level.HIGH))
        result = test_handler.evaluate(self.packet(2, Level.HIGH))
        state_data = test_handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert state_data.is_triggered is True
        assert state_data.status == Level.HIGH

        # Third evaluation does NOT trigger another result
        result = test_handler.evaluate(self.packet(3, Level.HIGH))
        assert result == {}

        # Three LOW results trigger low evaluation
        result = test_handler.evaluate(self.packet(4, Level.LOW))
        assert result == {}
        result = test_handler.evaluate(self.packet(5, Level.LOW))
        assert result == {}
        result = test_handler.evaluate(self.packet(6, Level.LOW))
        state_data = test_handler.state_manager.get_state_data([self.group_key])[self.group_key]
        assert state_data.is_triggered is True
        assert state_data.status == Level.LOW

    def test_evaluate__counter_reset_for_non_none_group_key(self) -> None:
        self.group_key = "group1"

        # Trigger HIGH priority
        result = self.handler.evaluate(self.packet(1, Level.HIGH))
        assert result == {}
        result = self.handler.evaluate(self.packet(2, Level.HIGH))
        assert result[self.group_key].priority == Level.HIGH

        # Evaluate again at HIGH priority (same as current state)
        result = self.handler.evaluate(self.packet(3, Level.HIGH))
        assert result == {}

        # Evaluate at MEDIUM priority - should require 2 evaluations to trigger
        result = self.handler.evaluate(self.packet(4, Level.MEDIUM))
        assert result == {}

        result = self.handler.evaluate(self.packet(5, Level.MEDIUM))
        assert result[self.group_key].priority == Level.MEDIUM

    def test_evaluate__condition_hole(self):
        detector = self.create_detector(
            name="Stateful Detector",
            project=self.project,
        )

        detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            comparison=5,
            type="lte",
            condition_result=Level.OK,
        )
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            comparison=10,
            type="gt",
            condition_result=Level.HIGH,
        )

        handler = MockDetectorStateHandler(
            detector=detector, thresholds={Level.OK: 1, Level.HIGH: 1}
        )

        critical_packet = self.packet(1, 15)
        critical_result = handler.evaluate(critical_packet)

        assert critical_result[self.group_key].priority == Level.HIGH

        missing_condition_packet = self.packet(2, 8)
        missing_condition_result = handler.evaluate(missing_condition_packet)

        # We shouldn't change state, because there wasn't a matching condition
        assert missing_condition_result == {}

        resolution_packet = self.packet(3, 2)
        resolution_result = handler.evaluate(resolution_packet)

        assert resolution_result[self.group_key].priority == Level.OK


class TestDetectorStateManagerRedisOptimization(TestCase):
    def setUp(self) -> None:
        self.detector = self.create_detector(
            name="Redis Optimization Detector",
            project=self.project,
        )
        self.handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={
                Level.LOW: 2,
                Level.HIGH: 3,
            },
        )
        self.group_keys = [None, "group1", "group2"]

    def test_get_state_data_uses_single_redis_pipeline(self) -> None:
        """
        Test that get_state_data uses only 1 Redis pipeline operation.
        """

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.get_redis_client"
        ) as mock_redis:
            mock_pipeline = mock.Mock()
            mock_redis.return_value.pipeline.return_value = mock_pipeline
            mock_pipeline.execute.return_value = ["0", "1", "2", "3", "4", "5"]  # Mock values

            # Call get_state_data
            self.handler.state_manager.get_state_data(self.group_keys)

            # Verify pipeline was created only once
            mock_redis.return_value.pipeline.assert_called_once()

            # Verify pipeline.execute was called only once
            mock_pipeline.execute.assert_called_once()

            # Verify multiple gets were added to the pipeline
            # Should be 3 groups * (1 dedupe + 2 counter keys) = 9 total gets
            expected_get_calls = 3 * (1 + len(self.handler.state_manager.counter_names))
            assert mock_pipeline.get.call_count == expected_get_calls

    def test_redis_key_mapping_generates_correct_keys(self) -> None:
        """
        Test that redis key mapping generates the expected keys.
        """
        state_manager = self.handler.state_manager
        key_mapping = state_manager.get_redis_keys_for_group_keys(self.group_keys)

        # Should have dedupe keys for each group
        dedupe_keys = [k for k, (_, key_type) in key_mapping.items() if key_type == "dedupe"]
        assert len(dedupe_keys) == len(self.group_keys)

        # Should have counter keys for each group and counter name
        counter_keys = [k for k, (_, key_type) in key_mapping.items() if key_type != "dedupe"]
        expected_counter_keys = len(self.group_keys) * len(state_manager.counter_names)
        assert len(counter_keys) == expected_counter_keys

    def test_bulk_get_redis_values_handles_empty_keys(self) -> None:
        """
        Test that bulk_get_redis_values handles empty key list correctly.
        """
        state_manager = self.handler.state_manager
        result = state_manager.bulk_get_redis_values([])
        assert result == {}
