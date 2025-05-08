import abc
import dataclasses
from collections.abc import Callable
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
    DetectorEvaluationResult,
    DetectorHandler,
    DetectorOccurrence,
)
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors.data_condition_group import (
    ProcessedDataConditionGroup,
    process_data_condition_group,
)
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel

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
    # Stateful detectors allow various counts to be tracked. We need to update these after we process workflows, so
    # include the updates in the state.
    # This dictionary is in the format {counter_name: counter_value, ...}
    # If a counter value is `None` it means to unset the value
    counter_updates: dict[str, int | None]


# TODO - refactor the `DetectorGroup` information out of this layer.
class DetectorStateManager:
    """
    TODO - Fix the Grouping info here, and move it out of the manager if possible.
    if not, refactor to have a base + a grouping base.
    """

    dedupe_updates: dict[DetectorGroupKey, int] = {}
    counter_updates: dict[DetectorGroupKey, dict[str, int | None]] = {}
    state_updates: dict[DetectorGroupKey, tuple[bool, DetectorPriorityLevel]] = {}
    counter_names: list[str] = []
    detector: Detector

    def __init__(
        self,
        detector: Detector,
        counter_names: list[str],
        key_builder: Callable[[str, str], str] | None = None,
    ):
        self.detector = detector
        self.counter_names = counter_names
        self.key_builder = key_builder

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int):
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_counter_update(
        self, group_key: DetectorGroupKey, counter_updates: dict[str, int | None]
    ):
        self.counter_updates[group_key] = counter_updates

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

    def _build_key(self, group_key: DetectorGroupKey, post_fix: str) -> str:
        if self.key_builder and group_key:
            return self.key_builder(group_key, post_fix)

        return f"{self.detector.id}:{post_fix}"

    def commit_state_updates(self):
        self._bulk_commit_detector_state()
        self._bulk_commit_redis_state()

    def _bulk_commit_dedupe_values(self, pipeline):
        for group_key, dedupe_value in self.dedupe_updates.items():
            pipeline.set(self._build_key(group_key, "dedupe_value"), dedupe_value, ex=REDIS_TTL)

    def _bulk_commit_counter_updates(self, pipeline):
        for group_key, counter_updates in self.counter_updates.items():
            for counter_name, counter_value in counter_updates.items():
                key_name = self._build_key(group_key, counter_name)

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
        dedupe_lookup_keys = [
            self._build_key(group_key, "dedupe_value") for group_key in group_keys
        ]
        dedupe_keys = self.get_dedupe_keys(dedupe_lookup_keys)
        pipeline = get_redis_client().pipeline()

        group_key_dedupe_values = {
            group_key: int(dedupe_value) if dedupe_value else 0
            for group_key, dedupe_value in zip(group_keys, dedupe_keys)
        }

        counter_updates = {}

        if self.counter_names:
            counter_keys = [
                self._build_key(group_key, counter_name)
                for group_key in group_keys
                for counter_name in self.counter_names
            ]
            for counter_key in counter_keys:
                pipeline.get(counter_key)
            values = [int(value) if value is not None else value for value in pipeline.execute()]

            counter_updates = {
                group_key: dict(zip(self.counter_names, values))
                for group_key, values in zip(group_keys, chunked(values, len(self.counter_names)))
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
                counter_updates=counter_updates.get(group_key, {}),
            )
        return results


class StatefulDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    DetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    def __init__(self, detector: Detector):
        super().__init__(detector)
        # TODO - is `thresholds` good? (check evans pr)
        if detector.config.get("thresholds"):
            raise Exception(
                "Stateful detectors are required to have `thresholds` set in the config"
            )

        self.state_manager = DetectorStateManager(detector)

    def _get_issue_occurrence_or_status_change(
        self, detector_occurrence: DetectorOccurrence
    ) -> IssueOccurrence | StatusChangeMessage:
        # TODO figure out if this is the right structure for collecting all the data.
        pass

    def _create_decorated_issue_occurrence(
        self,
        detector_occurrence: DetectorOccurrence,
        evaluation_result: ProcessedDataConditionGroup,
    ) -> IssueOccurrence:
        """
        Decorate the issue occurrence with the data from the detector's evaluation result.
        """
        return detector_occurrence.to_issue_occurrence(
            occurrence_id=str(uuid4()),
            project_id=self.detector.project_id,
            status=detector_occurrence.priority,
            detection_time=datetime.now(UTC),
            additional_evidence_data=detector_occurrence.evidence_data,
            fingerprint=[self.detector.id],
        )

    def _evaluation_detector_conditions(
        self, value: DataPacketEvaluationType
    ) -> tuple[ProcessedDataConditionGroup, DetectorPriorityLevel]:
        """
        Evaluate the detector.workflow_condition_group against the value in the data packet.

        Returns a tuple of the condition evaluation and the new priority level.
        """
        new_priority = DetectorPriorityLevel.OK

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

    def build_fingerprint(self, postfix: str | None) -> str:
        """
        Builds a fingerprint to uniquely identify a detected issue
        """
        if not postfix:
            return f"{self.detector.id}"
        return f"{self.detector.id}:{postfix}"

    def create_resolve_message(self) -> StatusChangeMessage:
        """
        Create a resolve message for the detectors issue
        """
        return StatusChangeMessage(
            fingerprint=self.build_fingerprint(),
            project_id=self.detector.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
        )

    def evaluate(self, data_packet: DataPacket[DataPacketType]) -> DetectorEvaluationResult:
        """
        This method evaluates the detector's conditions against the data packet's value.

        If the conditions are met, it will call `create_occurrence` in the implmenting class
        to create a detector occurrence.
        """
        detector_result: IssueOccurrence | StatusChangeMessage
        value = self.extract_value(data_packet)
        condition_evaluation, new_priority = self._evaluation_detector_conditions(value)
        state = self.state_manager.get_state_data([None])[None]

        if state.status == new_priority:
            return None

        if new_priority == DetectorPriorityLevel.OK:
            detector_result = self.create_resolve_message()
        else:
            # TODO - think through this bit later, as it's a new feature
            # get counter values for each state
            # if counter values > detector.config.get("thresholds", {}).get(new_priority) then create occurrence
            detector_occurrence, event_data = self.create_occurrence(
                condition_evaluation, data_packet, new_priority
            )
            detector_result = self._create_decorated_issue_occurrence(
                detector_occurrence, condition_evaluation
            )

        return DetectorEvaluationResult(
            is_triggered=new_priority != DetectorPriorityLevel.OK,
            priority=new_priority,
            result=detector_result,
            event_data=event_data,
        )


# TODO move to group.py?
class StatefulGroupingDetectorHandler(
    Generic[DataPacketType, DataPacketEvaluationType],
    DetectorHandler[DataPacketType, DataPacketEvaluationType],
    abc.ABC,
):
    def __init__(self, detector: Detector):
        super().__init__(detector)
        self.state_manager = DetectorStateManager(
            detector,
            self.counter_names,
            key_builder=self.build_key_for_group,
        )

    def build_key_for_group(self, group_key: DetectorGroupKey, post_fix: str | None = None) -> str:
        """
        Builds a key for the given group key. This is used to store the state of the detector in Redis.
        """
        return f"{self.detector.id}{':' + group_key if group_key is not None else ''}:{post_fix}"

    @property
    @abc.abstractmethod
    def counter_names(self) -> list[str]:
        """
        The names of the counters that this detector tracks. This is used to build the redis keys for
        storing counter values.
        """
        pass

    @abc.abstractmethod
    def extract_group_values(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DataPacketEvaluationType]:
        """
        Extracts the values for all the group keys that exist in the given data packet,
        and returns then as a dict keyed by group_key.
        """
        pass

    def build_fingerprint(self, group_key: DetectorGroupKey) -> list[str]:
        """
        Builds a fingerprint to uniquely identify a detected issue

        TODO - Take into account the data source / query that triggered the detector,
        we'll want to create a new issue if the query changes.
        """
        return [f"{self.detector.id}{':' + group_key if group_key is not None else ''}"]

    def evaluate(
        self, data_packet: DataPacket[DataPacketType]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        """
        Evaluates a given data packet and returns a list of `DetectorEvaluationResult`.
        There will be one result for each group key result in the packet, unless the
        evaluation is skipped due to various rules.
        """
        dedupe_value = self.extract_dedupe_value(data_packet)
        group_values = self.extract_group_values(data_packet)
        all_state_data = self.state_manager.get_state_data(list(group_values.keys()))
        results = {}
        for group_key, group_value in group_values.items():
            # invoke the stateful detector with the associated data. doesn't need the group key for evaluation
            # results returned here will be then committed in bulk
            result = self.evaluate_group_key_value(
                group_key, group_value, all_state_data[group_key], dedupe_value
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
    ) -> DetectorEvaluationResult | None:
        """
        Evaluates a value associated with a given `group_key` and returns a `DetectorEvaluationResult` with the results
        and any state changes that need to be made.

        Checks that we haven't already processed this datapacket for this group_key, and skips evaluation if we have.
        """
        if dedupe_value <= state_data.dedupe_value:
            # TODO: Does it actually make more sense to just do this at the data packet level rather than the group
            # key level?
            metrics.incr("workflow_engine.detector.skipping_already_processed_update")
            return None

        self.state_manager.enqueue_dedupe_update(group_key, dedupe_value)

        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None

        # TODO: We need to handle tracking consecutive evaluations before emitting a result here. We're able to
        # store these in `DetectorStateData.counter_updates`, but we don't have anywhere to set the required
        # thresholds at the moment. Probably should be a field on the Detector? Could also be on the condition
        # level, but usually we want to set this at a higher level.
        # -- we can store the thresholds on the detector.config -- seems like a field we could use for only stateful detectors
        new_status = DetectorPriorityLevel.OK
        processed_data_condition, _ = process_data_condition_group(self.condition_group.id, value)

        if processed_data_condition.logic_result:
            validated_condition_results: list[DetectorPriorityLevel] = [
                condition_result.result
                for condition_result in processed_data_condition.condition_results
                if condition_result.result is not None
                and isinstance(condition_result.result, DetectorPriorityLevel)
            ]

            new_status = max(new_status, *validated_condition_results)

        # TODO: We'll increment and change these later, but for now they don't change so just pass an empty dict
        self.state_manager.enqueue_counter_update(group_key, {})

        if state_data.status == new_status:
            return None

        is_triggered = new_status != DetectorPriorityLevel.OK
        self.state_manager.enqueue_state_update(group_key, is_triggered, new_status)

        event_data = None
        result: StatusChangeMessage | IssueOccurrence

        if new_status == DetectorPriorityLevel.OK:
            # If we've determined that we're now ok, we just want to resolve the issue
            result = StatusChangeMessage(
                fingerprint=self.build_fingerprint(group_key),
                project_id=self.detector.project_id,
                new_status=GroupStatus.RESOLVED,
                new_substatus=None,
            )
        else:
            detector_occurrence, event_data = self.create_occurrence(
                value, DetectorPriorityLevel(new_status)
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
                fingerprint=self.build_fingerprint(group_key),
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
