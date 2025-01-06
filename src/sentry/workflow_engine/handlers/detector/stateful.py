import abc
from datetime import timedelta
from typing import Any, TypeVar

from django.conf import settings
from django.db.models import Q
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.types.group import PriorityLevel
from sentry.utils import metrics, redis
from sentry.utils.iterators import chunked
from sentry.workflow_engine.handlers.detector.base import (
    DetectorEvaluationResult,
    DetectorHandler,
    DetectorStateData,
)
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors.data_condition_group import evaluate_condition_group
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel

T = TypeVar("T")
REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


class StatefulDetectorHandler(DetectorHandler[T], abc.ABC):
    def __init__(self, detector: Detector):
        super().__init__(detector)
        self.dedupe_updates: dict[DetectorGroupKey, int] = {}
        self.counter_updates: dict[DetectorGroupKey, dict[str, int | None]] = {}
        self.state_updates: dict[DetectorGroupKey, tuple[bool, DetectorPriorityLevel]] = {}

    @property
    @abc.abstractmethod
    def counter_names(self) -> list[str]:
        """
        The names of counters that this detector is going to keep track of.
        """
        pass

    @abc.abstractmethod
    def get_dedupe_value(self, data_packet: DataPacket[T]) -> int:
        """
        Extracts the deduplication value from a passed data packet.
        TODO: This might belong on the `DataPacket` instead.
        """
        pass

    @abc.abstractmethod
    def get_group_key_values(self, data_packet: DataPacket[T]) -> dict[DetectorGroupKey, int]:
        """
        Extracts the values for all the group keys that exist in the given data packet,
        and returns then as a dict keyed by group_key.
        """
        pass

    @abc.abstractmethod
    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, value: int, new_status: PriorityLevel
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        pass

    def build_fingerprint(self, group_key) -> list[str]:
        """
        Builds a fingerprint to uniquely identify a detected issue

        TODO - Take into account the data source / query that triggered the detector,
        we'll want to create a new issue if the query changes.
        """
        return [f"{self.detector.id}{':' + group_key if group_key is not None else ''}"]

    def get_state_data(
        self, group_keys: list[DetectorGroupKey]
    ) -> dict[DetectorGroupKey, DetectorStateData]:
        """
        Fetches state data associated with this detector for the associated `group_keys`.
        Returns a dict keyed by each group_key with the fetched `DetectorStateData`.
        If data isn't currently stored, falls back to default values.
        """
        group_key_detectors = self.bulk_get_detector_state(group_keys)
        dedupe_keys = [self.build_dedupe_value_key(gk) for gk in group_keys]
        pipeline = get_redis_client().pipeline()

        for dk in dedupe_keys:
            pipeline.get(dk)

        group_key_dedupe_values = {
            gk: int(dv) if dv else 0 for gk, dv in zip(group_keys, pipeline.execute())
        }

        pipeline.reset()
        counter_updates = {}

        if self.counter_names:
            counter_keys = [
                self.build_counter_value_key(gk, name)
                for gk in group_keys
                for name in self.counter_names
            ]
            for ck in counter_keys:
                pipeline.get(ck)
            vals = [int(val) if val is not None else val for val in pipeline.execute()]
            counter_updates = {
                gk: dict(zip(self.counter_names, values))
                for gk, values in zip(group_keys, chunked(vals, len(self.counter_names)))
            }

        results = {}
        for gk in group_keys:
            detector_state = group_key_detectors.get(gk)
            results[gk] = DetectorStateData(
                group_key=gk,
                active=detector_state.active if detector_state else False,
                status=(
                    DetectorPriorityLevel(int(detector_state.state))
                    if detector_state
                    else DetectorPriorityLevel.OK
                ),
                dedupe_value=group_key_dedupe_values[gk],
                counter_updates=counter_updates.get(gk, {}),
            )
        return results

    def evaluate(
        self, data_packet: DataPacket[T]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        """
        Evaluates a given data packet and returns a list of `DetectorEvaluationResult`.
        There will be one result for each group key result in the packet, unless the
        evaluation is skipped due to various rules.
        """
        dedupe_value = self.get_dedupe_value(data_packet)
        group_values = self.get_group_key_values(data_packet)
        all_state_data = self.get_state_data(list(group_values.keys()))
        results = {}
        for group_key, group_value in group_values.items():
            result = self.evaluate_group_key_value(
                group_key, group_value, all_state_data[group_key], dedupe_value
            )
            if result:
                results[result.group_key] = result
        return results

    def evaluate_group_key_value(
        self,
        group_key: DetectorGroupKey,
        value: int,
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

        self.enqueue_dedupe_update(group_key, dedupe_value)

        if not self.condition_group:
            metrics.incr("workflow_engine.detector.skipping_invalid_condition_group")
            return None

        # TODO: We need to handle tracking consecutive evaluations before emitting a result here. We're able to
        # store these in `DetectorStateData.counter_updates`, but we don't have anywhere to set the required
        # thresholds at the moment. Probably should be a field on the Detector? Could also be on the condition
        # level, but usually we want to set this at a higher level.
        new_status = DetectorPriorityLevel.OK
        is_group_condition_met, condition_results = evaluate_condition_group(
            self.condition_group, value
        )

        if is_group_condition_met:
            validated_condition_results: list[DetectorPriorityLevel] = [
                result
                for result in condition_results
                if result is not None and isinstance(result, DetectorPriorityLevel)
            ]

            new_status = max(new_status, *validated_condition_results)

        # TODO: We'll increment and change these later, but for now they don't change so just pass an empty dict
        self.enqueue_counter_update(group_key, {})

        if state_data.status != new_status:
            is_active = new_status != DetectorPriorityLevel.OK
            self.enqueue_state_update(group_key, is_active, new_status)
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
                result, event_data = self.build_occurrence_and_event_data(
                    group_key, value, PriorityLevel(new_status)
                )
            return DetectorEvaluationResult(
                group_key=group_key,
                is_active=is_active,
                priority=new_status,
                result=result,
                event_data=event_data,
            )
        return None

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int):
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_counter_update(
        self, group_key: DetectorGroupKey, counter_updates: dict[str, int | None]
    ):
        self.counter_updates[group_key] = counter_updates

    def enqueue_state_update(
        self, group_key: DetectorGroupKey, is_active: bool, priority: DetectorPriorityLevel
    ):
        self.state_updates[group_key] = (is_active, priority)

    def build_dedupe_value_key(self, group_key: DetectorGroupKey) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:dedupe_value"

    def build_counter_value_key(self, group_key: DetectorGroupKey, counter_name: str) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:{counter_name}"

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

    def commit_state_updates(self):
        self._bulk_commit_detector_state()
        self._bulk_commit_redis_state()

    def _bulk_commit_redis_state(self):
        pipeline = get_redis_client().pipeline()
        if self.dedupe_updates:
            for group_key, dedupe_value in self.dedupe_updates.items():
                pipeline.set(self.build_dedupe_value_key(group_key), dedupe_value, ex=REDIS_TTL)

        if self.counter_updates:
            for group_key, counter_updates in self.counter_updates.items():
                for counter_name, counter_value in counter_updates.items():
                    key_name = self.build_counter_value_key(group_key, counter_name)
                    if counter_value is None:
                        pipeline.delete(key_name)
                    else:
                        pipeline.set(key_name, counter_value, ex=REDIS_TTL)

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
        for group_key, (active, priority) in self.state_updates.items():
            detector_state = detector_state_lookup.get(group_key)
            if not detector_state:
                created_detector_states.append(
                    DetectorState(
                        detector_group_key=group_key,
                        detector=self.detector,
                        active=active,
                        state=priority,
                    )
                )
            elif active != detector_state.active or priority != detector_state.state:
                detector_state.active = active
                detector_state.state = priority
                updated_detector_states.append(detector_state)

        if created_detector_states:
            DetectorState.objects.bulk_create(created_detector_states)

        if updated_detector_states:
            DetectorState.objects.bulk_update(updated_detector_states, ["active", "state"])
        self.state_updates.clear()
