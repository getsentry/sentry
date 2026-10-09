import unittest.mock as mock
from datetime import timedelta
from typing import Any

import pytest

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.testutils.abstract import Abstract
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.workflow_engine.handlers.detector import DetectorStateData
from sentry.workflow_engine.handlers.detector.stateful import DetectorCounters, get_redis_client
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel
from tests.sentry.workflow_engine.handlers.detector.test_base import (
    MockDetectorStateHandler,
    assert_event_matches_occurrence,
)

Level = DetectorPriorityLevel


class StatefulDetectorTestCase(TestCase):
    """
    Builds detectors whose `eq` trigger conditions map a priority's name to that priority, so
    a packet carrying "HIGH" for a group evaluates to `DetectorPriorityLevel.HIGH`.
    """

    __test__ = Abstract(__module__, __qualname__)

    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector(name="Stateful Detector", project=self.project)

    def add_priority_conditions(self, *levels: DetectorPriorityLevel) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()

        for level in levels:
            self.create_data_condition(
                type="eq",
                comparison=level.name,
                condition_group=self.detector.workflow_condition_group,
                condition_result=level,
            )

    def packet(
        self, dedupe: int, result: DetectorPriorityLevel | int, group_key: DetectorGroupKey = None
    ) -> DataPacket[Any]:
        return self.grouped_packet(dedupe, {group_key: result})

    def grouped_packet(
        self, dedupe: int, results: dict[DetectorGroupKey, DetectorPriorityLevel | int]
    ) -> DataPacket[Any]:
        """Priorities are sent by name; any other value is sent as-is."""
        group_vals = {
            group_key: result.name if isinstance(result, DetectorPriorityLevel) else result
            for group_key, result in results.items()
        }

        return DataPacket(
            source_id=str(dedupe),
            packet={"id": str(dedupe), "dedupe": dedupe, "group_vals": group_vals},
        )

    def state(
        self, handler: MockDetectorStateHandler, group_key: DetectorGroupKey = None
    ) -> DetectorStateData:
        return handler.state_manager.get_state_data([group_key])[group_key]


class TestStatefulDetectorHandlerThresholds(StatefulDetectorTestCase):
    def _get_full_detector(self) -> Detector:
        """
        Fetches the detector with its workflow condition group and conditions prefetched.
        """
        detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert detector is not None
        return detector

    def test_detector_defaults_to_only_an_ok_threshold(self) -> None:
        handler = MockDetectorStateHandler(detector=self.detector)

        assert handler._thresholds == {Level.OK: 1}
        assert handler.state_manager.counter_names == [Level.OK]

    def test_detector_custom_thresholds_are_added_to_the_defaults(self) -> None:
        handler = MockDetectorStateHandler(detector=self.detector, thresholds={Level.LOW: 2})

        assert handler._thresholds == {Level.OK: 1, Level.LOW: 2}

    def test_detector_with_prefetched_conditions_builds_thresholds_without_queries(self) -> None:
        self.add_priority_conditions(Level.HIGH)
        self.detector.save()

        fetched_detector = self._get_full_detector()

        with self.assertNumQueries(0):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1, Level.HIGH: 1}

    def test_detector_with_no_conditions_builds_thresholds_without_queries(self) -> None:
        self.add_priority_conditions()
        self.detector.save()

        fetched_detector = self._get_full_detector()

        with self.assertNumQueries(0):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1}

    def test_detector_without_prefetched_conditions_queries_them_once(self) -> None:
        self.add_priority_conditions(Level.HIGH)
        self.detector.save()

        fetched_detector = Detector.objects.get(id=self.detector.id)

        with self.assertNumQueries(1):
            handler = MockDetectorStateHandler(detector=fetched_detector)
            assert handler._thresholds == {Level.OK: 1, Level.HIGH: 1}


class TestStatefulDetectorIncrementThresholds(StatefulDetectorTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MockDetectorStateHandler(detector=self.detector, thresholds={Level.HIGH: 2})

    def increment(self, priority: DetectorPriorityLevel) -> DetectorStateData:
        self.handler._increment_detector_thresholds(self.state(self.handler), priority, None)
        self.handler.state_manager.commit_state_updates()

        return self.state(self.handler)

    def test_detector_does_not_increment_counters_above_the_priority(self) -> None:
        assert self.increment(Level.MEDIUM).counter_updates == {Level.HIGH: None, Level.OK: None}

    def test_detector_does_not_increment_unconfigured_counters(self) -> None:
        assert self.increment(Level.LOW).counter_updates == {Level.OK: None, Level.HIGH: None}


class TestStatefulDetectorHandlerEvaluate(StatefulDetectorTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.add_priority_conditions(Level.OK, Level.LOW, Level.MEDIUM, Level.HIGH)

        self.handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={Level.LOW: 2, Level.MEDIUM: 2, Level.HIGH: 2},
        )

    def trigger(self, handler: MockDetectorStateHandler | None = None) -> None:
        """Two HIGH evaluations reach the HIGH threshold."""
        handler = handler or self.handler

        handler._evaluate(self.packet(1, Level.HIGH))
        handler._evaluate(self.packet(2, Level.HIGH))

    def test_detector_triggers_once_the_threshold_is_reached(self) -> None:
        assert self.handler._evaluate(self.packet(1, Level.HIGH)) == {}

        result = self.handler._evaluate(self.packet(2, Level.HIGH))
        evaluation = result[None]
        occurrence = evaluation.result

        assert evaluation.priority == Level.HIGH
        assert isinstance(occurrence, IssueOccurrence)
        assert occurrence.evidence_data["detector_id"] == self.detector.id

        # Stateful detectors use a fresh event id as the occurrence id
        assert occurrence.id == occurrence.event_id
        assert_event_matches_occurrence(evaluation.data["event_data"], occurrence)

        state = self.state(self.handler)

        assert state.is_triggered is True
        assert state.status == Level.HIGH
        assert state.counter_updates == {
            Level.HIGH: 2,
            Level.MEDIUM: 2,
            Level.LOW: 2,
            Level.OK: None,
        }

    def test_detector_high_evaluation_increments_all_counters(self) -> None:
        self.handler._evaluate(self.packet(1, Level.HIGH))

        assert self.state(self.handler).counter_updates == {
            **{level: 1 for level in Level},
            Level.OK: None,
        }

    def test_detector_resolves_after_an_ok_evaluation(self) -> None:
        self.trigger()

        result = self.handler._evaluate(self.packet(3, Level.OK))
        evaluation = result[None]

        assert isinstance(evaluation.result, StatusChangeMessage)
        assert evaluation.priority == Level.OK
        assert evaluation.result.detector_id == self.detector.id
        assert evaluation.result.fingerprint == [f"detector:{self.detector.id}"]

        state = self.state(self.handler)

        assert state.is_triggered is False
        assert state.status == Level.OK
        assert state.counter_updates == {level: None for level in self.handler._thresholds}

    def test_detector_triggers_again_after_resolving(self) -> None:
        self.trigger()
        self.handler._evaluate(self.packet(3, Level.OK))

        assert self.handler._evaluate(self.packet(4, Level.HIGH)) == {}
        assert self.state(self.handler).is_triggered is False

        result = self.handler._evaluate(self.packet(5, Level.HIGH))

        assert result[None].priority == Level.HIGH
        assert isinstance(result[None].result, IssueOccurrence)
        assert self.state(self.handler).status == Level.HIGH

    def test_detector_high_evaluations_count_toward_the_low_threshold(self) -> None:
        assert self.handler._evaluate(self.packet(1, Level.HIGH)) == {}

        result = self.handler._evaluate(self.packet(2, Level.LOW))

        assert isinstance(result[None].result, IssueOccurrence)
        assert result[None].priority == Level.LOW

    def test_detector_escalates_from_low_to_high(self) -> None:
        self.handler._evaluate(self.packet(1, Level.LOW))
        result = self.handler._evaluate(self.packet(2, Level.LOW))

        assert result[None].priority == Level.LOW

        assert self.handler._evaluate(self.packet(3, Level.HIGH)) == {}
        result = self.handler._evaluate(self.packet(4, Level.HIGH))

        assert isinstance(result[None].result, IssueOccurrence)
        assert result[None].priority == Level.HIGH

    def test_detector_ok_evaluation_resets_counters(self) -> None:
        self.handler._evaluate(self.packet(1, Level.HIGH))
        self.handler._evaluate(self.packet(2, Level.OK))

        assert self.handler._evaluate(self.packet(3, Level.HIGH)) == {}

    def test_detector_already_at_high_ignores_a_larger_low_threshold(self) -> None:
        handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={Level.LOW: 3, Level.MEDIUM: 2, Level.HIGH: 2},
        )

        self.trigger(handler)

        assert self.state(handler).status == Level.HIGH
        assert handler._evaluate(self.packet(3, Level.HIGH)) == {}

        # Three LOW evaluations de-escalate to LOW
        assert handler._evaluate(self.packet(4, Level.LOW)) == {}
        assert handler._evaluate(self.packet(5, Level.LOW)) == {}
        handler._evaluate(self.packet(6, Level.LOW))

        assert self.state(handler).is_triggered is True
        assert self.state(handler).status == Level.LOW

    def test_detector_resets_counters_after_triggering_for_a_group_key(self) -> None:
        group_key = "group1"

        assert self.handler._evaluate(self.packet(1, Level.HIGH, group_key)) == {}
        triggered = self.handler._evaluate(self.packet(2, Level.HIGH, group_key))

        assert triggered[group_key].priority == Level.HIGH

        # Matching the current state resets counters, so MEDIUM needs two more evaluations
        assert self.handler._evaluate(self.packet(3, Level.HIGH, group_key)) == {}
        assert self.handler._evaluate(self.packet(4, Level.MEDIUM, group_key)) == {}
        de_escalated = self.handler._evaluate(self.packet(5, Level.MEDIUM, group_key))

        assert de_escalated[group_key].priority == Level.MEDIUM

    def test_detector_group_keys_resolve_only_their_own_issue(self) -> None:
        both_high: dict[DetectorGroupKey, DetectorPriorityLevel | int] = {
            "group_a": Level.HIGH,
            "group_b": Level.HIGH,
        }
        self.handler._evaluate(self.grouped_packet(1, both_high))
        self.handler._evaluate(self.grouped_packet(2, both_high))

        result = self.handler._evaluate(self.grouped_packet(3, {"group_a": Level.OK}))

        assert set(result.keys()) == {"group_a"}
        assert isinstance(result["group_a"].result, StatusChangeMessage)
        assert result["group_a"].result.fingerprint == [f"detector:{self.detector.id}:group_a"]
        assert self.state(self.handler, "group_b").status == Level.HIGH

    def test_detector_skips_already_processed_packets(self) -> None:
        self.handler._evaluate(self.packet(1, Level.HIGH))

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.metrics"
        ) as mock_metrics:
            assert self.handler._evaluate(self.packet(1, Level.HIGH)) == {}

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.detector.skipping_already_processed_update"
        )
        assert self.state(self.handler).counter_updates[Level.HIGH] == 1

    def test_detector_without_a_condition_group_still_advances_dedupe(self) -> None:
        handler = MockDetectorStateHandler(self.create_detector(project=self.project))

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.condition.metrics"
        ) as mock_metrics:
            assert handler._evaluate(self.packet(2, Level.HIGH)) == {}

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.detector.skipping_invalid_condition_group"
        )
        assert self.state(handler).dedupe_value == 2

    def test_detector_keeps_its_state_when_no_condition_matches(self) -> None:
        self.detector = self.create_detector(project=self.project)
        self.detector.workflow_condition_group = self.create_data_condition_group(logic_type="any")
        self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            comparison=5,
            type="lte",
            condition_result=Level.OK,
        )
        self.create_data_condition(
            condition_group=self.detector.workflow_condition_group,
            comparison=10,
            type="gt",
            condition_result=Level.HIGH,
        )
        handler = MockDetectorStateHandler(detector=self.detector)

        assert handler._evaluate(self.packet(1, 15))[None].priority == Level.HIGH

        # Neither condition matches, so the state doesn't change
        assert handler._evaluate(self.packet(2, 8)) == {}

        assert handler._evaluate(self.packet(3, 2))[None].priority == Level.OK


class TestDetectorStateManager(StatefulDetectorTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.handler = MockDetectorStateHandler(
            detector=self.detector,
            thresholds={Level.LOW: 2, Level.HIGH: 3},
        )
        self.state_manager = self.handler.state_manager

    def test_build_key_includes_the_detector_group_and_postfix(self) -> None:
        assert self.state_manager.build_key() == f"detector:{self.detector.id}"
        assert self.state_manager.build_key("test") == f"detector:{self.detector.id}:test"
        assert (
            self.state_manager.build_key("test", "dedupe_value")
            == f"detector:{self.detector.id}:test:dedupe_value"
        )

    def test_get_state_data_returns_committed_and_default_state(self) -> None:
        empty_counters: DetectorCounters = {level: None for level in self.handler._thresholds}
        committed = DetectorStateData(
            group_key="committed",
            is_triggered=True,
            status=Level.HIGH,
            dedupe_value=100,
            counter_updates={**empty_counters, Level.HIGH: 5},
        )

        self.state_manager.enqueue_dedupe_update(committed.group_key, committed.dedupe_value)
        self.state_manager.enqueue_counter_update(committed.group_key, committed.counter_updates)
        self.state_manager.enqueue_state_update(
            committed.group_key, committed.is_triggered, committed.status
        )
        self.state_manager.commit_state_updates()

        assert self.state_manager.get_state_data(["committed", "uncommitted"]) == {
            "committed": committed,
            "uncommitted": DetectorStateData(
                group_key="uncommitted",
                is_triggered=False,
                status=Level.OK,
                dedupe_value=0,
                counter_updates=empty_counters,
            ),
        }

    def test_commit_state_updates_writes_postgres_and_redis(self) -> None:
        redis = get_redis_client()
        dedupe_key = self.state_manager.build_key(None, "dedupe_value")
        counter_key_1 = self.state_manager.build_key(None, "some_counter")
        counter_key_2 = self.state_manager.build_key(None, "another_counter")

        self.state_manager.enqueue_dedupe_update(None, 100)
        self.state_manager.enqueue_counter_update(None, {"some_counter": 1, "another_counter": 2})
        self.state_manager.enqueue_state_update(None, True, Level.OK)
        self.state_manager.commit_state_updates()

        assert DetectorState.objects.filter(
            detector=self.detector, detector_group_key=None, is_triggered=True, state=Level.OK
        ).exists()
        assert redis.get(dedupe_key) == "100"
        assert redis.get(counter_key_1) == "1"
        assert redis.get(counter_key_2) == "2"

        # A `None` counter deletes its key
        self.state_manager.enqueue_dedupe_update(None, 150)
        self.state_manager.enqueue_counter_update(
            None, {"some_counter": None, "another_counter": 20}
        )
        self.state_manager.enqueue_state_update(None, False, Level.OK)
        self.state_manager.commit_state_updates()

        assert DetectorState.objects.filter(
            detector=self.detector, detector_group_key=None, is_triggered=False, state=Level.OK
        ).exists()
        assert redis.get(dedupe_key) == "150"
        assert not redis.exists(counter_key_1)
        assert redis.get(counter_key_2) == "20"

    def test_bulk_commit_skips_update_when_state_unchanged(self) -> None:
        detector_state = self.create_detector_state(
            detector=self.detector,
            detector_group_key=None,
            is_triggered=False,
            state=Level.OK,
        )

        self.state_manager.enqueue_state_update(None, is_triggered=True, priority=Level.HIGH)
        with mock.patch.object(
            DetectorState.objects, "bulk_update", wraps=DetectorState.objects.bulk_update
        ) as mock_bulk_update:
            self.state_manager.commit_state_updates()
            mock_bulk_update.assert_called_once()

        detector_state.refresh_from_db()
        assert detector_state.is_triggered is True
        assert detector_state.state == str(Level.HIGH)

        self.state_manager.enqueue_state_update(None, is_triggered=True, priority=Level.HIGH)
        with mock.patch.object(DetectorState.objects, "bulk_update") as mock_bulk_update:
            self.state_manager.commit_state_updates()
            mock_bulk_update.assert_not_called()

    def test_get_state_data_uses_single_redis_pipeline(self) -> None:
        group_keys: list[DetectorGroupKey] = [None, "group1", "group2"]

        with mock.patch(
            "sentry.workflow_engine.handlers.detector.stateful.get_redis_client"
        ) as mock_redis:
            mock_pipeline = mock.Mock()
            mock_redis.return_value.pipeline.return_value = mock_pipeline
            mock_pipeline.execute.return_value = ["0", "1", "2", "3", "4", "5"]

            self.state_manager.get_state_data(group_keys)

            mock_redis.return_value.pipeline.assert_called_once()
            mock_pipeline.execute.assert_called_once()

            # One dedupe key and one key per counter, for each group
            expected_get_calls = len(group_keys) * (1 + len(self.state_manager.counter_names))
            assert mock_pipeline.get.call_count == expected_get_calls

    def test_bulk_get_redis_values_handles_empty_keys(self) -> None:
        assert self.state_manager.bulk_get_redis_values([]) == {}


class MockRotatingDetectorStateHandler(MockDetectorStateHandler):
    activation_creates_new_issue = True


class MockFingerprintedRotatingDetectorStateHandler(MockRotatingDetectorStateHandler):
    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        return ["custom-fingerprint"]


class TestStatefulDetectorActivationId(StatefulDetectorTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.add_priority_conditions(Level.OK, Level.MEDIUM, Level.HIGH)

    def activation_id(
        self, handler: MockDetectorStateHandler, group_key: DetectorGroupKey = None
    ) -> int | None:
        return self.state(handler, group_key).activation_id

    def fingerprint(self, handler: MockDetectorStateHandler, packet: DataPacket[Any]) -> list[str]:
        detector_result = handler._evaluate(packet)[None].result

        assert detector_result is not None
        return list(detector_result.fingerprint)

    def stable_fingerprint(self) -> list[str]:
        return [f"detector:{self.detector.id}"]

    def activation_fingerprint(self, activation_id: int | None) -> list[str]:
        return [f"detector:{self.detector.id}:activation:{activation_id}"]

    def test_detector_without_a_project_uses_org_for_feature_flag(self) -> None:
        """
        An all-projects detector has project=NULL and carries its org in config, so
        `linked_project` raises for it and cannot be used to check the flag.
        """
        org_scoped_detector = self.create_all_projects_detector(self.organization)

        assert org_scoped_detector.project is None

        handler = MockRotatingDetectorStateHandler(detector=org_scoped_detector)

        assert handler._get_detector_organization() == self.organization

        with self.feature("organizations:workflow-engine-rotate-activation-id"):
            assert handler._should_rotate_activation_id() is True

    def test_detector_without_a_project_or_organization_raises_value_error(self) -> None:
        orphaned_detector = self.create_all_projects_detector(self.organization)
        orphaned_detector.config = {}

        handler = MockRotatingDetectorStateHandler(detector=orphaned_detector)

        with pytest.raises(ValueError):
            handler._get_detector_organization()

    def test_detector_opted_in_with_issue_fingerprint_override_raises_value_error(self) -> None:
        handler = MockFingerprintedRotatingDetectorStateHandler(detector=self.detector)

        with pytest.raises(ValueError):
            handler.build_occurrence_fingerprint(None, activation_id=None)

    def test_detector_not_opted_in_never_rotates(self) -> None:
        handler = MockDetectorStateHandler(detector=self.detector)

        with self.feature("organizations:workflow-engine-rotate-activation-id"):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.HIGH))

            assert self.activation_id(handler) is None

            resolution_fingerprint = self.fingerprint(handler, self.packet(2, Level.OK))

        assert firing_fingerprint == self.stable_fingerprint()
        assert resolution_fingerprint == self.stable_fingerprint()

    def test_detector_opted_in_with_flag_off_never_rotates(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with self.feature({"organizations:workflow-engine-rotate-activation-id": False}):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.HIGH))

            assert self.activation_id(handler) is None

            resolution_fingerprint = self.fingerprint(handler, self.packet(2, Level.OK))

        assert firing_fingerprint == self.stable_fingerprint()
        assert resolution_fingerprint == self.stable_fingerprint()

    def test_detector_leaving_ok_state_sets_activation_id_to_current_time(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)
        activated_at = before_now(days=1).replace(microsecond=0)

        with (
            self.feature("organizations:workflow-engine-rotate-activation-id"),
            freeze_time(activated_at),
        ):
            handler._evaluate(self.packet(1, Level.HIGH))

        assert self.activation_id(handler) == int(activated_at.timestamp() * 1000)

    def test_detector_priority_changes_keep_the_activation(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with (
            self.feature("organizations:workflow-engine-rotate-activation-id"),
            freeze_time() as frozen_time,
        ):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.MEDIUM))
            activation_id = self.activation_id(handler)

            frozen_time.shift(timedelta(seconds=1))
            escalation_fingerprint = self.fingerprint(handler, self.packet(2, Level.HIGH))

            frozen_time.shift(timedelta(seconds=1))
            de_escalation_fingerprint = self.fingerprint(handler, self.packet(3, Level.MEDIUM))

            frozen_time.shift(timedelta(seconds=1))
            resolution_fingerprint = self.fingerprint(handler, self.packet(4, Level.OK))

            assert self.activation_id(handler) == activation_id

        assert escalation_fingerprint == firing_fingerprint
        assert de_escalation_fingerprint == firing_fingerprint
        assert resolution_fingerprint == firing_fingerprint

    def test_detector_refiring_starts_a_new_activation(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with (
            self.feature("organizations:workflow-engine-rotate-activation-id"),
            freeze_time() as frozen_time,
        ):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.HIGH))
            initial_activation_id = self.activation_id(handler)

            resolution_fingerprint = self.fingerprint(handler, self.packet(2, Level.OK))

            frozen_time.shift(timedelta(seconds=1))
            next_firing_fingerprint = self.fingerprint(handler, self.packet(3, Level.HIGH))
            next_activation_id = self.activation_id(handler)

        assert initial_activation_id is not None
        assert next_activation_id is not None
        assert next_activation_id != initial_activation_id

        assert firing_fingerprint == self.activation_fingerprint(initial_activation_id)
        # The resolve has to match the firing it closes, or the issue is stranded open.
        assert resolution_fingerprint == firing_fingerprint
        assert next_firing_fingerprint == self.activation_fingerprint(next_activation_id)

    def test_detector_group_keys_rotate_activation_id_independently(self) -> None:
        """
        Ensure one group key firing or resolving does not mess up another group key
        """
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with (
            self.feature("organizations:workflow-engine-rotate-activation-id"),
            freeze_time() as frozen_time,
        ):
            handler._evaluate(
                self.grouped_packet(1, {"group_a": Level.HIGH, "group_b": Level.HIGH})
            )

            group_a_initial_activation_id = self.activation_id(handler, "group_a")
            group_b_initial_activation_id = self.activation_id(handler, "group_b")

            assert group_a_initial_activation_id is not None
            assert group_b_initial_activation_id is not None

            frozen_time.shift(timedelta(seconds=1))
            handler._evaluate(self.grouped_packet(2, {"group_a": Level.OK}))

            assert self.activation_id(handler, "group_a") == group_a_initial_activation_id
            assert self.activation_id(handler, "group_b") == group_b_initial_activation_id

            frozen_time.shift(timedelta(seconds=1))
            handler._evaluate(self.grouped_packet(3, {"group_a": Level.HIGH}))

            group_a_next_activation_id = self.activation_id(handler, "group_a")

            assert group_a_next_activation_id is not None
            assert group_a_next_activation_id != group_a_initial_activation_id
            assert self.activation_id(handler, "group_b") == group_b_initial_activation_id

    def test_detector_turning_flag_on_still_resolves_open_issue(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with self.feature({"organizations:workflow-engine-rotate-activation-id": False}):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.HIGH))

        with self.feature("organizations:workflow-engine-rotate-activation-id"):
            resolution_fingerprint = self.fingerprint(handler, self.packet(2, Level.OK))

            # Only the firing after the cutover rotates.
            next_firing_fingerprint = self.fingerprint(handler, self.packet(3, Level.HIGH))
            next_activation_id = self.activation_id(handler)

        assert firing_fingerprint == self.stable_fingerprint()
        assert resolution_fingerprint == self.stable_fingerprint()
        assert next_firing_fingerprint == self.activation_fingerprint(next_activation_id)

    def test_detector_turning_flag_off_still_resolves_open_issue(self) -> None:
        handler = MockRotatingDetectorStateHandler(detector=self.detector)

        with self.feature("organizations:workflow-engine-rotate-activation-id"):
            firing_fingerprint = self.fingerprint(handler, self.packet(1, Level.HIGH))

        with self.feature({"organizations:workflow-engine-rotate-activation-id": False}):
            resolution_fingerprint = self.fingerprint(handler, self.packet(2, Level.OK))

        assert resolution_fingerprint == firing_fingerprint
