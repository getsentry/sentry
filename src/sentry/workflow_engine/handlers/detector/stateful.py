import abc
import dataclasses
import logging
from datetime import timedelta
from typing import Any, Generic, cast
from uuid import uuid4

from django.conf import settings
from django.db.models import Q
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.base import camel_to_snake_case, convert_dict_key_case
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.utils import metrics, redis
from sentry.workflow_engine.handlers.detector.base import (
    DataPacketEvaluationType,
    DataPacketType,
    DetectorHandler,
    DetectorOccurrence,
    EventData,
    GroupedDetectorEvaluationResult,
)
from sentry.workflow_engine.models import DataPacket, DataSource, Detector, DetectorState
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    process_data_condition_group,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)

logger = logging.getLogger(__name__)

REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


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


# TODO - we might want to extract this into another file to reduce noise in this file.
class DetectorStateManager:
    dedupe_updates: dict[DetectorGroupKey, int]
    counter_updates: dict[DetectorGroupKey, DetectorCounters]
    state_updates: dict[DetectorGroupKey, tuple[bool, DetectorPriorityLevel]]
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

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int):
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_counter_reset(self, group_key: DetectorGroupKey = None) -> None:
        """
        Resets the counter values for the detector.
        This method is to reset the counters when the detector is resolved.
        """
        self.counter_updates[group_key] = {key: None for key in self.counter_names}

    def enqueue_counter_update(
        self, group_key: DetectorGroupKey, counter_updates: DetectorCounters
    ):
        self.counter_updates[group_key] = counter_updates

    def enqueue_state_update(
        self, group_key: DetectorGroupKey, is_triggered: bool, priority: DetectorPriorityLevel
    ):
        self.state_updates[group_key] = (is_triggered, priority)

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

    def commit_state_updates(self):
        self._bulk_commit_detector_state()
        self._bulk_commit_redis_state()

    def _bulk_commit_dedupe_values(self, pipeline):
        for group_key, dedupe_value in self.dedupe_updates.items():
            pipeline.set(self.build_key(group_key, "dedupe_value"), dedupe_value, ex=REDIS_TTL)

    def _bulk_commit_counter_updates(self, pipeline):
        for group_key, counter_updates in self.counter_updates.items():
            for counter_name, counter_value in counter_updates.items():
                key_name = self.build_key(group_key, counter_name)

                if counter_value is None:
                    pipeline.delete(key_name)
                else:
                    pipeline.set(key_name, counter_value, ex=REDIS_TTL)

    def _bulk_commit_redis_state(self, key: DetectorGroupKey | None = None):
        pipeline = get_redis_client().pipeline()
        if self.dedupe_updates:
            self._bulk_commit_dedupe_values(pipeline)

        if self.counter_updates:
            self._bulk_commit_counter_updates(pipeline)

        pipeline.execute()

        self.dedupe_updates.clear()
        self.counter_updates.clear()

    def _bulk_commit_detector_state(self):
        # TODO: We should already have these loaded from earlier, figure out how to cache and reuse
        detector_state_lookup = self.bulk_get_detector_state(
            [update for update in self.state_updates.keys()]
        )
        created_detector_states = []
        updated_detector_states = []

        for group_key, (is_triggered, priority) in self.state_updates.items():
            detector_state = detector_state_lookup.get(group_key)
            if not detector_state:
                created_detector_states.append(
                    DetectorState(
                        detector_group_key=group_key,
                        detector=self.detector,
                        is_triggered=is_triggered,
                        state=priority,
                    )
                )
            elif is_triggered != detector_state.is_triggered or priority != detector_state.state:
                detector_state.is_triggered = is_triggered
                detector_state.state = priority
                updated_detector_states.append(detector_state)

        if created_detector_states:
            DetectorState.objects.bulk_create(created_detector_states)

        if updated_detector_states:
            DetectorState.objects.bulk_update(updated_detector_states, ["is_triggered", "state"])

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
            )
        return results


DetectorThresholds = dict[DetectorPriorityLevel, int]


class StatefulDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    DetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    """
    Stateful Detectors are provided as a base class for new detectors that need to track state.
    """

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

    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        """
        A hook that allows for additional fingerprinting to be added to the detectors issue occurrences.
        By default the fingerprint will be the detector id and group key.
        """
        return []

    def build_detector_evidence_data(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[DataPacketType],
        priority: DetectorPriorityLevel,
    ) -> dict[str, Any]:
        """
        Build detector-specific evidence data.
        A detector handler can implement this to add its own evidence data in addition to the workflow engine evidence data.
        """
        return {}

    def _build_evidence_data_sources(
        self, data_packet: DataPacket[DataPacketType]
    ) -> list[dict[str, Any]]:
        try:
            data_sources = list(
                DataSource.objects.filter(detectors=self.detector, source_id=data_packet.source_id)
            )
            if not data_sources:
                logger.warning(
                    "Matching data source not found for detector while generating occurrence evidence data",
                    extra={
                        "detector_id": self.detector.id,
                        "data_packet_source_id": data_packet.source_id,
                    },
                )
                return []
            # Serializers return camelcased keys, but evidence data should use snakecase
            return convert_dict_key_case(serialize(data_sources), camel_to_snake_case)
        except Exception:
            logger.exception(
                "Failed to serialize data source definition when building workflow engine evidence data"
            )
            return []

    def _build_workflow_engine_evidence_data(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
    ) -> dict[str, Any]:
        """
        Build the workflow engine specific evidence data.
        This is data that is common to all detectors.
        """
        base: dict[str, Any] = {
            "detector_id": self.detector.id,
            "value": evaluation_value,
            "data_packet_source_id": str(data_packet.source_id),
            "conditions": [
                result.condition.get_snapshot() for result in evaluation_result.condition_results
            ],
            "config": self.detector.config,
            "data_sources": self._build_evidence_data_sources(data_packet),
        }

        return base

    def evaluate_impl(
        self, data_packet: DataPacket[DataPacketType]
    ) -> GroupedDetectorEvaluationResult:
        dedupe_value = self.extract_dedupe_value(data_packet)
        group_data_values = self._extract_value_from_packet(data_packet)
        state = self.state_manager.get_state_data(list(group_data_values.keys()))
        results: dict[DetectorGroupKey, DetectorEvaluationResult] = {}

        tainted = False

        for group_key, data_value in group_data_values.items():
            state_data: DetectorStateData = state[group_key]
            if dedupe_value <= state_data.dedupe_value:
                metrics.incr("workflow_engine.detector.skipping_already_processed_update")
                continue

            self.state_manager.enqueue_dedupe_update(group_key, dedupe_value)

            condition_results, evaluated_priority = self._evaluation_detector_conditions(
                group_data_values[group_key]
            )

            if condition_results is not None and condition_results.logic_result.is_tainted():
                tainted = True

            if condition_results is None or condition_results.logic_result.triggered is False:
                # Invalid condition result, nothing we can do
                # Or if we didn't match any conditions in the evaluation
                continue

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

            self.state_manager.enqueue_state_update(
                group_key,
                new_priority != DetectorPriorityLevel.OK,
                new_priority,
            )

            results[group_key] = self._build_detector_evaluation_result(
                group_key,
                new_priority,
                condition_results,
                data_packet,
                data_value,
            )

        self.state_manager.commit_state_updates()
        return GroupedDetectorEvaluationResult(result=results, tainted=tainted)

    def _create_resolve_message(
        self,
        condition_results: ProcessedDataConditionGroup,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
        group_key: DetectorGroupKey = None,
    ) -> StatusChangeMessage:
        # Call create_occurrence to get a DetectorOccurrence with OK priority
        # This allows detector handlers to customize resolution data (e.g., detection_time)
        detector_occurrence, _ = self.create_occurrence(
            condition_results, data_packet, DetectorPriorityLevel.OK
        )

        fingerprint = [
            *self.build_issue_fingerprint(),
            self.state_manager.build_key(group_key),
        ]

        # Merge evidence data from workflow engine, detector handler, and detector occurrence
        evidence_data = {
            **self._build_workflow_engine_evidence_data(
                evaluation_result=condition_results,
                data_packet=data_packet,
                evaluation_value=evaluation_value,
            ),
            **self.build_detector_evidence_data(
                condition_results,
                data_packet,
                DetectorPriorityLevel.OK,
            ),
            **detector_occurrence.evidence_data,
        }

        return StatusChangeMessage(
            fingerprint=fingerprint,
            project_id=self.detector.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
            detector_id=self.detector.id,
            activity_data=evidence_data,
            update_date=detector_occurrence.detection_time,
        )

    def _extract_value_from_packet(
        self,
        data_packet: DataPacket[DataPacketType],
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        This method will normalize the extracted value to support grouping results.

        If `extract_value` returns a `dict[DetectorGroupKey, DataPacketEvaluationType]`
        it will cast it to the correct data type.

        If `extract_value` returns a single value, it will be wrapped in a dict
        with `None` as the key, to normalize the type as `dict[DetectorGroupKey, DataPacketEvaluationType]`.
        """
        data_values = self.extract_value(data_packet)
        group_data_values: dict[DetectorGroupKey, DataPacketEvaluationType] = {}

        # Normalize the type to dict[DetectorGroupKey, DataPacketEvaluationType]
        if self._is_detector_group_value(data_values):
            group_data_values = cast(dict[DetectorGroupKey, DataPacketEvaluationType], data_values)
        else:
            group_data_values = {None: cast(DataPacketEvaluationType, data_values)}

        return group_data_values

    def _build_detector_evaluation_result(
        self,
        group_key: DetectorGroupKey,
        new_priority: DetectorPriorityLevel,
        condition_results: ProcessedDataConditionGroup,
        data_packet: DataPacket[DataPacketType],
        evaluation_value: DataPacketEvaluationType,
    ) -> DetectorEvaluationResult:
        detector_result: IssueOccurrence | StatusChangeMessage
        event_data: EventData | None = None

        if new_priority == DetectorPriorityLevel.OK:
            detector_result = self._create_resolve_message(
                condition_results,
                data_packet,
                evaluation_value,
                group_key,
            )
        else:
            # Call the `create_occurrence` method to create the detector occurrence.
            detector_occurrence, event_data = self.create_occurrence(
                condition_results, data_packet, new_priority
            )
            detector_result = self._create_decorated_issue_occurrence(
                data_packet,
                detector_occurrence,
                condition_results,
                new_priority,
                group_key,
                evaluation_value,
            )

            # Set the event data with the necessary fields
            event_data["environment"] = self.detector.config.get("environment")
            event_data["timestamp"] = detector_result.detection_time
            event_data["project_id"] = detector_result.project_id
            event_data["event_id"] = detector_result.event_id
            event_data.setdefault("platform", "python")
            event_data.setdefault("received", detector_result.detection_time)
            event_data.setdefault("tags", {})

        return DetectorEvaluationResult(
            group_key=group_key,
            is_triggered=new_priority != DetectorPriorityLevel.OK,
            priority=new_priority,
            result=detector_result,
            event_data=event_data,
        )

    def _is_detector_group_value(self, value) -> bool:
        """
        Check if value is dict[DetectorGroupKey, DataPacketEvaluationType]
        """
        if not isinstance(value, dict):
            return False

        if not value:  # Empty dict case
            return False

        # Check if all keys are DetectorGroupKey instances
        return all(isinstance(key, DetectorGroupKey) for key in value.keys())

    def _get_configured_detector_levels(self) -> list[DetectorPriorityLevel]:
        conditions = self.detector.get_conditions()
        return list(DetectorPriorityLevel(condition.condition_result) for condition in conditions)

    def _create_decorated_issue_occurrence(
        self,
        data_packet: DataPacket[DataPacketType],
        detector_occurrence: DetectorOccurrence,
        evaluation_result: ProcessedDataConditionGroup,
        new_priority: DetectorPriorityLevel,
        group_key: DetectorGroupKey,
        data_value: DataPacketEvaluationType,
    ) -> IssueOccurrence:
        """
        Decorate the issue occurrence with the data from the detector's evaluation result.
        """
        evidence_data = self._build_workflow_engine_evidence_data(
            evaluation_result,
            data_packet,
            data_value,
        )

        fingerprint = [
            *self.build_issue_fingerprint(group_key),
            self.state_manager.build_key(group_key),
        ]

        return detector_occurrence.to_issue_occurrence(
            fingerprint=fingerprint,
            occurrence_id=str(uuid4()),
            project_id=self.detector.project_id,
            status=new_priority,
            additional_evidence_data=evidence_data,
        )

    def _evaluation_detector_conditions(
        self, value: DataPacketEvaluationType
    ) -> tuple[ProcessedDataConditionGroup | None, DetectorPriorityLevel]:
        """
        Evaluate the detector.workflow_condition_group against the value in the data packet.

        Returns a tuple of the condition evaluation and the new priority level.
        """
        new_priority = DetectorPriorityLevel.OK
        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None, new_priority

        condition_evaluation, remaining_slow_conditions = process_data_condition_group(
            self.condition_group, value
        )
        if remaining_slow_conditions:
            logger.warning(
                "Slow conditions present for detector",
                extra={
                    "detector_id": self.detector.id,
                    "condition_group_id": self.condition_group.id,
                },
            )

        if condition_evaluation.logic_result.triggered:
            validated_condition_results: list[DetectorPriorityLevel] = [
                condition_result.result
                for condition_result in condition_evaluation.condition_results
                if condition_result.result is not None
                and isinstance(condition_result.result, DetectorPriorityLevel)
            ]
            if validated_condition_results:
                new_priority = max(new_priority, *validated_condition_results)

        return condition_evaluation, new_priority

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
