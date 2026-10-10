import abc
import dataclasses
import time
from collections.abc import Mapping
from datetime import timedelta
from typing import Any, ClassVar, override
from uuid import uuid4

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry import features
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.organization import Organization
from sentry.utils import metrics, redis
from sentry.workflow_engine.handlers.detector.base import (
    DataPacketEvaluationType,
    DataPacketType,
    DetectorEvaluations,
    EventData,
)
from sentry.workflow_engine.handlers.detector.condition import DetectorHandler
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors import DataConditionGroupEvaluation, DetectorEvaluation
from sentry.workflow_engine.processors.evaluations import DetectorEvaluationData
from sentry.workflow_engine.types import (
    DetectorGroupKey,
    DetectorPriorityLevel,
)

REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


def _get_unix_epoch_time_in_milliseconds() -> int:
    return time.time_ns() // 1_000_000


DetectorCounter = str | DetectorPriorityLevel
DetectorCounters = dict[DetectorCounter, int | None]


@dataclasses.dataclass(frozen=True)
class DetectorStateData:
    group_key: DetectorGroupKey
    is_triggered: bool
    status: DetectorPriorityLevel

    # Stateful detectors always process data packets in order. Once we confirm that a data packet has been fully
    # processed and all workflows have been done, this value will be used by the stateful detector to prevent
    # reprocessing
    dedupe_value: int

    # Stateful detectors allow various counts to be tracked.
    # By default, Stateful Detectors will track their priority level
    # threshold values as counters.
    # We need to update these after we process workflows, so
    # include the updates in the state.
    # This dictionary is in the format {counter_name: counter_value, ...}
    # If a counter value is `None` it means to unset the value
    counter_updates: DetectorCounters

    activation_id: int | None = None


@dataclasses.dataclass(frozen=True)
class DetectorStateUpdate:
    is_triggered: bool
    priority: DetectorPriorityLevel
    activation_id: int | None


# TODO - we might want to extract this into another file to reduce noise in this file.
class DetectorStateManager:
    dedupe_updates: dict[DetectorGroupKey, int]
    counter_updates: dict[DetectorGroupKey, DetectorCounters]
    state_updates: dict[DetectorGroupKey, DetectorStateUpdate]
    counter_names: list[DetectorCounter]
    detector: Detector

    def __init__(
        self,
        detector: Detector,
        counter_names: list[DetectorCounter] | None = None,
    ):
        self.detector = detector
        self.counter_names = counter_names or []
        self.dedupe_updates = {}
        self.counter_updates = {}
        self.state_updates = {}

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int) -> None:
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_counter_reset(self, group_key: DetectorGroupKey = None) -> None:
        """
        Resets the counter values for the detector.
        This method is to reset the counters when the detector is resolved.
        """
        self.counter_updates[group_key] = {key: None for key in self.counter_names}

    def enqueue_counter_update(
        self, group_key: DetectorGroupKey, counter_updates: DetectorCounters
    ) -> None:
        self.counter_updates[group_key] = counter_updates

    def enqueue_state_update(
        self,
        group_key: DetectorGroupKey,
        is_triggered: bool,
        priority: DetectorPriorityLevel,
        activation_id: int | None = None,
    ) -> None:
        self.state_updates[group_key] = DetectorStateUpdate(
            is_triggered=is_triggered,
            priority=priority,
            activation_id=activation_id,
        )

    def get_redis_keys_for_group_keys(
        self, group_keys: list[DetectorGroupKey]
    ) -> dict[str, tuple[DetectorGroupKey, str | DetectorCounter]]:
        """
        Generate all Redis keys needed for the given group keys.
        Returns {redis_key: (group_key, key_type)} for efficient bulk fetching and processing.

        key_type can be:
        - "dedupe" for dedupe value keys
        - DetectorCounter (str | DetectorPriorityLevel) for counter keys
        """
        key_mapping: dict[str, tuple[DetectorGroupKey, str | DetectorCounter]] = {}

        # Dedupe keys
        for group_key in group_keys:
            dedupe_key = self.build_key(group_key, "dedupe_value")
            key_mapping[dedupe_key] = (group_key, "dedupe")

        # Counter keys
        for group_key in group_keys:
            for counter_name in self.counter_names:
                counter_key = self.build_key(group_key, counter_name)
                key_mapping[counter_key] = (group_key, counter_name)

        return key_mapping

    def bulk_get_redis_values(self, redis_keys: list[str]) -> dict[str, Any]:
        """
        Fetch multiple Redis values in a single pipeline operation.
        """
        if not redis_keys:
            return {}

        pipeline = get_redis_client().pipeline()
        for key in redis_keys:
            pipeline.get(key)

        values = pipeline.execute()
        return dict(zip(redis_keys, values))

    def bulk_get_detector_state(
        self, group_keys: list[DetectorGroupKey]
    ) -> dict[DetectorGroupKey, DetectorState]:
        """
        Bulk fetches detector state for the passed `group_keys`. Returns a dict keyed by each
        `group_key` with the fetched `DetectorStateData`.

        If there's no `DetectorState` row for a `detector`/`group_key` pair then we'll exclude
        the group_key from the returned dict.
        """
        # TODO: Cache this query (or individual fetches, then bulk fetch anything missing)
        query_filter = Q(
            detector_group_key__in=[group_key for group_key in group_keys if group_key is not None]
        )
        if None in group_keys:
            query_filter |= Q(detector_group_key__isnull=True)

        return {
            detector_state.detector_group_key: detector_state
            for detector_state in self.detector.detectorstate_set.filter(query_filter)
        }

    def build_key(
        self, group_key: DetectorGroupKey = None, postfix: str | int | None = None
    ) -> str:
        key = f"detector:{self.detector.id}"
        group_postfix = f"{group_key if group_key is not None else ''}"

        if postfix:
            group_postfix = f"{group_postfix}:{postfix}"

        if group_postfix:
            return f"{key}:{group_postfix}"

        return key

    def commit_state_updates(self) -> None:
        self._bulk_commit_detector_state()
        self._bulk_commit_redis_state()

    def _bulk_commit_dedupe_values(self, pipeline: Any) -> None:
        for group_key, dedupe_value in self.dedupe_updates.items():
            pipeline.set(self.build_key(group_key, "dedupe_value"), dedupe_value, ex=REDIS_TTL)

    def _bulk_commit_counter_updates(self, pipeline: Any) -> None:
        for group_key, counter_updates in self.counter_updates.items():
            for counter_name, counter_value in counter_updates.items():
                key_name = self.build_key(group_key, counter_name)

                if counter_value is None:
                    pipeline.delete(key_name)
                else:
                    pipeline.set(key_name, counter_value, ex=REDIS_TTL)

    def _bulk_commit_redis_state(self, key: DetectorGroupKey | None = None) -> None:
        pipeline = get_redis_client().pipeline()
        if self.dedupe_updates:
            self._bulk_commit_dedupe_values(pipeline)

        if self.counter_updates:
            self._bulk_commit_counter_updates(pipeline)

        pipeline.execute()

        self.dedupe_updates.clear()
        self.counter_updates.clear()

    def _bulk_commit_detector_state(self) -> None:
        # TODO: We should already have these loaded from earlier, figure out how to cache and reuse
        detector_state_lookup = self.bulk_get_detector_state(
            [update for update in self.state_updates.keys()]
        )
        created_detector_states = []
        updated_detector_states = []

        for group_key, state_update in self.state_updates.items():
            detector_state = detector_state_lookup.get(group_key)
            if not detector_state:
                created_detector_states.append(
                    DetectorState(
                        detector_group_key=group_key,
                        detector=self.detector,
                        is_triggered=state_update.is_triggered,
                        state=state_update.priority,
                        activation_id=state_update.activation_id,
                        date_added=timezone.now(),
                    )
                )
            elif (
                state_update.is_triggered != detector_state.is_triggered
                or state_update.priority != detector_state.priority_level
                or state_update.activation_id != detector_state.activation_id
            ):
                detector_state.is_triggered = state_update.is_triggered
                detector_state.state = state_update.priority
                detector_state.activation_id = state_update.activation_id
                detector_state.date_updated = timezone.now()
                updated_detector_states.append(detector_state)

        if created_detector_states:
            DetectorState.objects.bulk_create(created_detector_states)

        if updated_detector_states:
            DetectorState.objects.bulk_update(
                updated_detector_states,
                ["is_triggered", "state", "activation_id", "date_updated"],
            )

        self.state_updates.clear()

    def get_state_data(
        self, group_keys: list[DetectorGroupKey]
    ) -> dict[DetectorGroupKey, DetectorStateData]:
        """
        Fetches state data associated with this detector for the associated `group_keys`.
        Returns a dict keyed by each group_key with the fetched `DetectorStateData`.
        If data isn't currently stored, falls back to default values.
        """
        group_key_detectors = self.bulk_get_detector_state(group_keys)

        # Get Redis keys and fetch values in single pipeline operation
        redis_key_mapping = self.get_redis_keys_for_group_keys(group_keys)
        redis_values = self.bulk_get_redis_values(list(redis_key_mapping.keys()))

        # Process values using the mapping
        group_key_dedupe_values: dict[DetectorGroupKey, int] = {}
        counter_updates: dict[DetectorGroupKey, DetectorCounters] = {}

        # Initialize counter_updates for all group keys
        for group_key in group_keys:
            counter_updates[group_key] = {}

        # Process all values using the mapping
        for redis_key, redis_value in redis_values.items():
            group_key, key_type = redis_key_mapping[redis_key]

            if key_type == "dedupe":
                group_key_dedupe_values[group_key] = int(redis_value) if redis_value else 0
            else:
                # key_type is a counter name (DetectorCounter)
                counter_updates[group_key][key_type] = (
                    int(redis_value) if redis_value is not None else redis_value
                )

        # Ensure all group keys have dedupe values (default to 0 if not found)
        for group_key in group_keys:
            if group_key not in group_key_dedupe_values:
                group_key_dedupe_values[group_key] = 0

        results = {}
        for group_key in group_keys:
            detector_state = group_key_detectors.get(group_key)
            results[group_key] = DetectorStateData(
                group_key=group_key,
                is_triggered=detector_state.is_triggered if detector_state else False,
                status=(
                    DetectorPriorityLevel(int(detector_state.state))
                    if detector_state
                    else DetectorPriorityLevel.OK
                ),
                dedupe_value=group_key_dedupe_values[group_key],
                counter_updates=counter_updates.get(group_key, {}),
                activation_id=detector_state.activation_id if detector_state else None,
            )
        return results


DetectorThresholds = dict[DetectorPriorityLevel, int]


class StatefulDetectorHandler(
    DetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    """
    Stateful Detectors are provided as a base class for new detectors that need to track state.
    """

    # If this flag is true, unique issues will be generated for each open period
    # If this flag is false, a new open period will regress a previous issue instead.
    activation_creates_new_issue: ClassVar[bool] = False

    def __init__(self, detector: Detector, thresholds: DetectorThresholds | None = None):
        super().__init__(detector)

        # Default to 1 for all the possible levels on a given detector
        default_thresholds = {level: 1 for level in self._get_configured_detector_levels()}

        self._thresholds: DetectorThresholds = {
            DetectorPriorityLevel.OK: 1,  # Make sure the OK level is always set
            **default_thresholds,
            **(self.thresholds),  # Allow each handler to override
            **(thresholds or {}),  # Allow each instance to override
        }

        self.state_manager = DetectorStateManager(detector, list(self._thresholds.keys()))

    @property
    def thresholds(self) -> DetectorThresholds:
        """
        Configure default thresholds at the detector level.
        """
        return {}

    @abc.abstractmethod
    def extract_dedupe_value(self, data_packet: DataPacket[DataPacketType]) -> int:
        """
        Extracts the de-duplication value from a passed data packet. This duplication
        value is used to determine if we've already processed data to this point or not.

        This is normally a timestamp, but could be any sortable value; (e.g. a sequence number, timestamp, etc).
        """
        pass

    def build_occurrence_fingerprint(
        self, group_key: DetectorGroupKey, activation_id: int | None
    ) -> list[str]:
        """
        Builds a fingerprint for an occurrence
        This function determines which issues get resolved as well as if newly breached thresholds create new issues
        or regress old ones.
        """
        detector_key = self.state_manager.build_key(group_key)

        issue_fingerprint = self.build_issue_fingerprint(group_key)

        if self.activation_creates_new_issue and issue_fingerprint:
            raise ValueError(
                f"Detector {self.detector.id} cannot override `build_issue_fingerprint` "
                "while `activation_creates_new_issue` is set"
            )

        stable_fingerprint = [
            *issue_fingerprint,
            detector_key,
        ]

        if not self.activation_creates_new_issue:
            return stable_fingerprint

        # If the activation_id is None, that means an issue was open prior to the class variable being set to true
        # In this case, we must resolve the same fingerprint as before so the issue can receive updates
        # and eventually be resolved.
        if activation_id is None:
            return stable_fingerprint

        return [f"{detector_key}:activation:{activation_id}"]

    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        """
        A hook that allows for additional fingerprinting to be added to the detectors issue occurrences.
        You may not override this hook if `activation_creates_new_issue` is true, or else it may interfere with unique issue creation
        """
        return []

    def build_detector_evidence_data(
        self,
        group_evaluation: DataConditionGroupEvaluation | None,
        data_packet: DataPacket[DataPacketType],
        priority: DetectorPriorityLevel,
    ) -> dict[str, Any]:
        """
        Build detector-specific evidence data.
        A detector handler can implement this to add its own evidence data in addition to the workflow engine evidence data.
        """
        return {}

    @override
    def get_event_id(self, event_data: EventData) -> str:
        """
        Stateful detectors always generate a new event id; the occurrence id reuses it.
        """
        return str(uuid4())

    @override
    def get_occurrence_id(self, group_key: DetectorGroupKey, event_id: str) -> str:
        return event_id

    @override
    def evaluate(
        self,
        data_packet: DataPacket[DataPacketType],
        values: Mapping[DetectorGroupKey, DataPacketEvaluationType],
    ) -> DetectorEvaluations:
        """
        Layers dedupe, priority thresholds, and durable state over `DetectorHandler.evaluate`.

        Groups that already processed this packet's dedupe value are skipped. Each remaining group's
        condition evaluation advances its threshold counters, and only priority transitions produce
        a result: an occurrence for a non-OK priority, or a resolution when the group returns to OK.
        """
        dedupe_value = self.extract_dedupe_value(data_packet)
        state = self.state_manager.get_state_data(list(values.keys()))
        should_rotate_activation_id = self._should_rotate_activation_id()
        unprocessed_values: dict[DetectorGroupKey, DataPacketEvaluationType] = {}

        for group_key, data_value in values.items():
            if dedupe_value <= state[group_key].dedupe_value:
                metrics.incr("workflow_engine.detector.skipping_already_processed_update")
                continue

            self.state_manager.enqueue_dedupe_update(group_key, dedupe_value)
            unprocessed_values[group_key] = data_value

        condition_evaluations = super().evaluate(data_packet, unprocessed_values)
        results: dict[DetectorGroupKey, DetectorEvaluation] = {}

        for group_key, condition_evaluation in condition_evaluations.result.items():
            state_data = state[group_key]
            evaluated_priority = condition_evaluation.priority

            if state_data.status == evaluated_priority:
                # evaluated priority is equal to current detector state.
                # Nothing to do and no thresholds to increment

                # Reset counters if any were incremented while evaluating a
                # different priority (but not reaching thresholds)
                if any(state_data.counter_updates.values()):
                    self.state_manager.enqueue_counter_reset(group_key)

                continue

            updated_threshold_counts = self._increment_detector_thresholds(
                state_data, evaluated_priority, group_key
            )

            new_priority = self._has_breached_threshold(updated_threshold_counts)

            if new_priority is None:
                # We haven't met any thresholds yet
                continue

            if state_data.status == new_priority:
                # breached threshold priority matches existing threshold, do
                # not report an occurrence.
                continue

            # OK counts are reset
            if new_priority == DetectorPriorityLevel.OK:
                self.state_manager.enqueue_counter_reset(group_key)

            activation_id = self._get_activation_id(
                state_data, new_priority, should_rotate_activation_id
            )

            self.state_manager.enqueue_state_update(
                group_key,
                new_priority != DetectorPriorityLevel.OK,
                new_priority,
                activation_id,
            )
            results[group_key] = self._build_detector_evaluation_result(
                group_key,
                new_priority,
                condition_evaluation.data["trigger_group_evaluation"],
                data_packet,
                unprocessed_values[group_key],
                activation_id,
            )

        self.state_manager.commit_state_updates()
        return DetectorEvaluations(result=results, tainted=condition_evaluations.tainted)

    def _create_resolve_message(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
        fingerprint: list[str],
    ) -> StatusChangeMessage:
        evidence_data = {
            **dataclasses.asdict(
                self._build_detector_evidence(evaluation, data_packet, evaluation_value)
            ),
            **self.build_detector_evidence_data(
                evaluation.data["trigger_group_evaluation"],
                data_packet,
                DetectorPriorityLevel.OK,
            ),
        }

        return StatusChangeMessage(
            fingerprint=fingerprint,
            project_id=self.detector.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            detector_id=self.detector.id,
            activity_data=evidence_data,
        )

    def _build_detector_evaluation_result(
        self,
        group_key: DetectorGroupKey,
        new_priority: DetectorPriorityLevel,
        group_evaluation: DataConditionGroupEvaluation | None,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
        activation_id: int | None = None,
    ) -> DetectorEvaluation:
        evaluation = DetectorEvaluation(
            result=None,
            data=DetectorEvaluationData(
                group_key=group_key,
                trigger_group_evaluation=group_evaluation,
                event_data=None,
            ),
            triggered=new_priority != DetectorPriorityLevel.OK,
            priority=new_priority,
        )
        fingerprint = self.build_occurrence_fingerprint(group_key, activation_id)

        if new_priority == DetectorPriorityLevel.OK:
            resolve_message = self._create_resolve_message(
                evaluation, data_packet, evaluation_value, fingerprint
            )
            return dataclasses.replace(evaluation, result=resolve_message)

        return self._create_occurrence(
            evaluation, data_packet, evaluation_value, fingerprint=fingerprint
        )

    def _get_configured_detector_levels(self) -> list[DetectorPriorityLevel]:
        conditions = self.detector.get_conditions()
        return list(DetectorPriorityLevel(condition.condition_result) for condition in conditions)

    def _increment_detector_thresholds(
        self,
        state: DetectorStateData,
        new_priority: DetectorPriorityLevel,
        group_key: DetectorGroupKey = None,
    ) -> DetectorCounters:
        results: DetectorCounters = {}

        if new_priority == DetectorPriorityLevel.OK:
            incremented_value = (state.counter_updates.get(new_priority) or 0) + 1
            results.update({level: None for level in self._thresholds.keys()})
            results.update({new_priority: incremented_value})
        else:
            for level in self._thresholds.keys():
                if level <= new_priority and level != DetectorPriorityLevel.OK:
                    incremented_value = (state.counter_updates.get(level) or 0) + 1
                    results.update({level: incremented_value})

        self.state_manager.enqueue_counter_update(group_key, results)
        return results

    def _has_breached_threshold(
        self,
        updated_threshold_counts: DetectorCounters,
    ) -> DetectorPriorityLevel | None:
        """
        Get the list of configured thresholds, then sort them to find the highest
        breached threshold.

        If the threshold is breached, return the highest breached threshold level.
        """
        threshold_keys: list[DetectorPriorityLevel] = list(self._thresholds.keys())
        threshold_keys.sort(reverse=True)

        for level in threshold_keys:
            level_count = updated_threshold_counts.get(level)
            if level_count is not None and level_count >= self._thresholds[level]:
                return level

        return None

    def _should_rotate_activation_id(self) -> bool:
        """
        Whether this detector should start a new activation on each OK -> non-OK transition.
        For some detectors this is never the case, while for others it depends on the
        organization's feature flag
        """
        if not self.activation_creates_new_issue:
            return False

        organization = self._get_detector_organization()

        return features.has(
            "organizations:workflow-engine-rotate-activation-id",
            organization,
        )

    def _get_activation_id(
        self,
        state_data: DetectorStateData,
        new_priority: DetectorPriorityLevel,
        should_rotate_activation_id: bool,
    ) -> int | None:
        if not should_rotate_activation_id:
            return state_data.activation_id

        is_leaving_ok_state = (
            state_data.status == DetectorPriorityLevel.OK
            and new_priority != DetectorPriorityLevel.OK
        )

        if is_leaving_ok_state:
            return _get_unix_epoch_time_in_milliseconds()

        return state_data.activation_id

    def _get_detector_organization(self) -> Organization:
        """
        Attempt to resolve organization from detector
        "All projects detectors" don't have a linked project so resolve from the config,
        similar to how we do it in `process_detectors`
        """
        if self.detector.project is not None:
            return self.detector.project.organization

        organization_id = self.detector.config.get("organization_id")

        if organization_id is None:
            raise ValueError(
                f"Detector {self.detector.id} has neither a project nor an organization_id"
            )

        return Organization.objects.get_from_cache(id=organization_id)
