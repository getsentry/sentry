import abc
import dataclasses
from datetime import UTC, datetime, timedelta
from typing import Generic
from uuid import uuid4

from django.conf import settings
from django.db.models import Q
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.utils import metrics, redis
from sentry.utils.iterators import chunked
from sentry.workflow_engine.handlers.detector.base import (
    DataPacketEvaluationType,
    DataPacketType,
    DetectorHandler,
    DetectorOccurrence,
)
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    process_data_condition_group,
)
from sentry.workflow_engine.types import (
    DetectorEvaluationResult,
    DetectorGroupKey,
    DetectorPriorityLevel,
)

REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


@dataclasses.dataclass(frozen=True)
class DetectorStateData:
    group_key: DetectorGroupKey
    is_triggered: bool
    status: DetectorPriorityLevel
    # Stateful detectors always process data packets in order. Once we confirm that a data packet has been fully
    # processed and all workflows have been done, this value will be used by the stateful detector to prevent
    # reprocessing
    dedupe_value: int
    # Stateful detectors can track thresholds for DetectorPriorityLevel
    # transitions. This dictionary maps the count of consecutive evauations for
    # each DetectorPriorityLevel.
    threshold_counts: dict[DetectorPriorityLevel, int | None]


class DetectorStateManager:
    """
    :Thinking: should this class not have a DetectorGroupKey? It is only needed for the grouping detector
    and would better encapsulate the responsibilities there... but isn't needed rn.
    """

    dedupe_updates: dict[DetectorGroupKey, int] = {}
    threshold_updates: dict[DetectorGroupKey, dict[DetectorPriorityLevel, int | None]] = {}
    state_updates: dict[DetectorGroupKey, tuple[bool, DetectorPriorityLevel]] = {}
    detector: Detector

    def __init__(self, detector: Detector):
        self.detector = detector

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int):
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_threshold_update(
        self,
        group_key: DetectorGroupKey,
        threshold_updates: dict[DetectorPriorityLevel, int | None],
    ):
        self.threshold_updates[group_key] = threshold_updates

    def enqueue_state_update(
        self, group_key: DetectorGroupKey, is_triggered: bool, priority: DetectorPriorityLevel
    ):
        self.state_updates[group_key] = (is_triggered, priority)

    def get_dedupe_keys(self, keys: list[str]) -> list[str]:
        """
        Returns a list of dedupe keys for the given group keys.
        """
        pipeline = get_redis_client().pipeline()

        for dedupe_key in keys:
            pipeline.get(dedupe_key)

        dedupe_keys = pipeline.execute()
        pipeline.reset()
        return dedupe_keys

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

    def build_key(self, group_key: DetectorGroupKey = None, postfix: str | None = None) -> str:
        group_postfix = f"{group_key if group_key is not None else ''}"

        if postfix:
            group_postfix = f"{group_postfix}:{postfix}"

        if group_postfix:
            return f"{self.detector.id}:{group_postfix}"

        return f"{self.detector.id}"

    def commit_state_updates(self):
        self._bulk_commit_detector_state()
        self._bulk_commit_redis_state()

    def _bulk_commit_dedupe_values(self, pipeline):
        for group_key, dedupe_value in self.dedupe_updates.items():
            pipeline.set(self.build_key(group_key, "dedupe_value"), dedupe_value, ex=REDIS_TTL)

    def _bulk_commit_threshold_updates(self, pipeline):
        for group_key, threshold_updates in self.threshold_updates.items():
            for threshold_level, threshold_value in threshold_updates.items():
                key_name = self._build_key(group_key, str(threshold_level))

                if threshold_value is None:
                    pipeline.delete(key_name)
                else:
                    pipeline.set(key_name, threshold_value, ex=REDIS_TTL)

    def _bulk_commit_redis_state(self, key: DetectorGroupKey | None = None):
        pipeline = get_redis_client().pipeline()
        if self.dedupe_updates:
            self._bulk_commit_dedupe_values(pipeline)

        if self.threshold_updates:
            self._bulk_commit_threshold_updates(pipeline)

        pipeline.execute()

        self.dedupe_updates.clear()
        self.threshold_updates.clear()

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
        dedupe_lookup_keys = [self.build_key(group_key, "dedupe_value") for group_key in group_keys]
        dedupe_keys = self.get_dedupe_keys(dedupe_lookup_keys)
        pipeline = get_redis_client().pipeline()

        group_key_dedupe_values = {
            group_key: int(dedupe_value) if dedupe_value else 0
            for group_key, dedupe_value in zip(group_keys, dedupe_keys)
        }

        threshold_updates = {}
        priority_thresholds: list[DetectorPriorityLevel] = self.detector.config.get(
            "priority_thresholds", {}
        ).keys()

        if priority_thresholds:
            priority_threshold_keys = [
                self._build_key(group_key, str(priority_level))
                for group_key in group_keys
                for priority_level in priority_thresholds
            ]
            for priority_threshold_key in priority_threshold_keys:
                pipeline.get(priority_threshold_key)
            values = [int(value) if value is not None else value for value in pipeline.execute()]

            threshold_updates = {
                group_key: dict(zip(priority_thresholds, values))
                for group_key, values in zip(group_keys, chunked(values, len(priority_thresholds)))
            }

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
                threshold_counts=threshold_updates.get(group_key, {}),
            )
        return results


class StatefulDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    DetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    @abc.abstractmethod
    def extract_dedupe_value(self, data_packet: DataPacket[DataPacketType]) -> int:
        """
        Extracts the deduplication value from a passed data packet. This duplication
        value is used to determine if we've already processed data to this point or not.

        This is normally a timestamp, but could be any sortable value; (e.g. a sequence number, timestamp, etc).
        """
        pass

    def __init__(self, detector: Detector):
        super().__init__(detector)
        self.state_manager = DetectorStateManager(detector)

    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        return []

    def create_resolve_message(self) -> StatusChangeMessage:
        """
        Create a resolve message for the detectors issue. This is overridable in the subclass, but
        will work for the majority of cases.
        """
        return StatusChangeMessage(
            fingerprint=[*self.build_issue_fingerprint(), self.state_manager.build_key()],
            project_id=self.detector.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
        )

    def _evaluate_is_duplicate(self, data_packet: DataPacket[DataPacketType]) -> bool:
        """
        Get the dedupe value from the state and compare it to the current data packet
        If the dedupe value is greater than the current data packet, return True
        """
        state = self.state_manager.get_state_data([None])[None]
        dedupe_value = self.extract_dedupe_value(data_packet)
        return state.dedupe_value >= dedupe_value

    def _evaluate_priority_threshold(self, new_priority: DetectorPriorityLevel) -> bool:
        """
        Get the threshold information from the state and compare it to the detector's config.
        If the new priority count + 1 is greater than the threshold (same as >=), return True
        """
        status_threshold = self.detector.config.get("priority_thresholds", {}).get(new_priority, 0)
        current_priority_count = self.state_manager.get_state_data([None])[
            None
        ].threshold_counts.get(new_priority, 0)
        return current_priority_count >= status_threshold

    def _create_decorated_issue_occurrence(
        self,
        detector_occurrence: DetectorOccurrence,
        evaluation_result: ProcessedDataConditionGroup,
        new_priority: DetectorPriorityLevel,
    ) -> IssueOccurrence:
        """
        Decorate the issue occurrence with the data from the detector's evaluation result.
        """
        evidence_data = {
            **detector_occurrence.evidence_data,
            "detector_id": self.detector.id,
            "value": new_priority,
            "conditions": [
                result.condition.get_snapshot() for result in evaluation_result.condition_results
            ],
        }

        return detector_occurrence.to_issue_occurrence(
            occurrence_id=str(uuid4()),
            project_id=self.detector.project_id,
            status=new_priority,
            detection_time=datetime.now(UTC),
            additional_evidence_data=evidence_data,
            fingerprint=[self.state_manager.build_key()],
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

        condition_evaluation, _ = process_data_condition_group(self.condition_group.id, value)

        if condition_evaluation.logic_result:
            validated_condition_results: list[DetectorPriorityLevel] = [
                condition_result.result
                for condition_result in condition_evaluation.condition_results
                if condition_result.result is not None
                and isinstance(condition_result.result, DetectorPriorityLevel)
            ]

            new_priority = max(new_priority, *validated_condition_results)

        return condition_evaluation, new_priority

    def evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult] | None:
        """
        This method evaluates the detector's conditions against the data packet's value.

        If the conditions are met, it will call `create_occurrence` in the implementing class
        to create a detector occurrence.
        """
        detector_result: IssueOccurrence | StatusChangeMessage

        if self._evaluate_is_duplicate(data_packet):
            metrics.incr("workflow_engine.detector.skipping_already_processed_update")
            return None

        value = self.extract_value(data_packet)
        condition_evaluation, new_priority = self._evaluation_detector_conditions(value)
        state = self.state_manager.get_state_data([None])[None]

        if state.status == new_priority or not condition_evaluation:
            return None

        # TODO - enqueue state update here?
        self.state_manager.enqueue_threshold_update(None, {new_priority: 1})

        if new_priority == DetectorPriorityLevel.OK:
            detector_result = self.create_resolve_message()
        else:
            # TODO - think through this bit later
            # thresholds = self.state_manager.get_thresholds(None)
            # if thresholds[new_priority] > detector.config.get("thresholds", {}).get(new_priority):
            # create the issue occurrence, otherwise we just needed the state update
            detector_occurrence, event_data = self.create_occurrence(
                condition_evaluation, data_packet, new_priority
            )
            detector_result = self._create_decorated_issue_occurrence(
                detector_occurrence, condition_evaluation, new_priority
            )

        return {
            None: DetectorEvaluationResult(
                group_key=None,
                is_triggered=new_priority != DetectorPriorityLevel.OK,
                priority=new_priority,
                result=detector_result,
                event_data=event_data,
            )
        }


# TODO move to grouping.py as GroupingDetectorHandler?
class StatefulGroupingDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    StatefulDetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    @abc.abstractmethod
    def extract_group_values(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        Extracts the values for all the group keys that exist in the given data packet,
        and returns then as a dict keyed by group_key.
        """
        pass

    def evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        """
        Overrides the base evaluation method, to evaluate in groups instead.
        """
        return self.evaluate_groups(data_packet)

    def evaluate_groups(
        self,
        data_packet: DataPacket[DataPacketType],
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        dedupe_value = self.extract_dedupe_value(data_packet)
        group_values = self.extract_group_values(data_packet)
        all_state_data = self.state_manager.get_state_data(list(group_values.keys()))
        results = {}

        for group_key, group_value in group_values.items():
            # invoke the stateful detector with the associated data. doesn't need the group key for evaluation
            # results returned here will be then committed in bulk
            result = self.evaluate_group_key_value(
                group_key,
                group_value,
                all_state_data[group_key],
                dedupe_value,
                data_packet,
            )
            if result:
                results[result.group_key] = result

        self.state_manager.commit_state_updates()
        return results

    def evaluate_group_key_value(
        self,
        group_key: DetectorGroupKey,
        value: DataPacketEvaluationType,
        state_data: DetectorStateData,
        dedupe_value: int,
        data_packet: DataPacket[DataPacketType],
    ) -> DetectorEvaluationResult | None:
        """
        Evaluates a value associated with a given `group_key` and returns a `DetectorEvaluationResult` with the results
        and any state changes that need to be made.

        Checks that we haven't already processed this data-packet for this group_key, and skips evaluation if we have.
        """
        # TODO - compose this method using the helpers in the base class.
        if dedupe_value <= state_data.dedupe_value:
            metrics.incr("workflow_engine.detector.skipping_already_processed_update")
            return None

        self.state_manager.enqueue_dedupe_update(group_key, dedupe_value)

        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None

        new_status = DetectorPriorityLevel.OK
        processed_data_condition, new_status = self._evaluation_detector_conditions(value)

        # TODO - add update for the thresholds here...
        # self.state_manager.update_thresholds(group_key, new_status)

        if state_data.status == new_status or not processed_data_condition:
            return None

        is_triggered = new_status != DetectorPriorityLevel.OK
        self.state_manager.enqueue_state_update(group_key, is_triggered, new_status)

        event_data = None
        result: StatusChangeMessage | IssueOccurrence

        if new_status == DetectorPriorityLevel.OK:
            result = StatusChangeMessage(
                fingerprint=[
                    *self.build_issue_fingerprint(group_key),
                    self.state_manager.build_key(group_key),
                ],
                project_id=self.detector.project_id,
                new_status=GroupStatus.RESOLVED,
                new_substatus=None,
            )
        else:
            detector_occurrence, event_data = self.create_occurrence(
                processed_data_condition, data_packet, new_status
            )
            evidence_data = {
                **detector_occurrence.evidence_data,
                "detector_id": self.detector.id,
                "value": value,
            }
            result = detector_occurrence.to_issue_occurrence(
                occurrence_id=str(uuid4()),
                project_id=self.detector.project_id,
                status=new_status,
                detection_time=datetime.now(UTC),
                additional_evidence_data=evidence_data,
                fingerprint=[
                    *self.build_issue_fingerprint(group_key),
                    self.state_manager.build_key(group_key),
                ],
            )
            event_data["timestamp"] = result.detection_time
            event_data["project_id"] = result.project_id
            event_data["event_id"] = result.event_id
            event_data.setdefault("platform", "python")
            event_data.setdefault("received", result.detection_time)
            event_data.setdefault("tags", {})

        return DetectorEvaluationResult(
            group_key=group_key,
            is_triggered=is_triggered,
            priority=new_status,
            result=result,
            event_data=event_data,
        )
