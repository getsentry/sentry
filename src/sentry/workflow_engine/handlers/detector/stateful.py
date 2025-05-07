import abc
from datetime import UTC, datetime, timedelta
from typing import Any, Generic, TypeVar
from uuid import uuid4

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
    DetectorOccurrence,
    DetectorStateData,
)
from sentry.workflow_engine.models import DataPacket, Detector, DetectorState
from sentry.workflow_engine.processors.data_condition_group import process_data_condition_group
from sentry.workflow_engine.types import DetectorGroupKey, DetectorPriorityLevel

PacketT = TypeVar("PacketT")
ConditionValueT = TypeVar("ConditionValueT")

REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


class StatefulGroupingDetectorHandler(
    Generic[PacketT, ConditionValueT],
    DetectorHandler[PacketT],
    abc.ABC,
):
    """
    StatefulDetectorHandler is a partial handler implementation that supports
    maintaining state across individual detector evaluations. This includes
    capabilities to:

    - De-duplication already processed packets by tracking already-seen
      `dedup_value`s. Override the `get_dedupe_value` method to return the
      value from the DataPacket that should be used to uniquely identify the
      packet. Future packets with the same identifier will not be processed.

    - Track's thresholds to transition between DetectorPriorityLevel's. This
      can be configured by overriding the `get_priority_transition_thresholds`.
    """

    def __init__(self, detector: Detector):
        super().__init__(detector)
        self.dedupe_updates: dict[DetectorGroupKey, int] = {}
        self.state_updates: dict[DetectorGroupKey, tuple[bool, DetectorPriorityLevel]] = {}
        self.threshold_incrs: dict[DetectorGroupKey, DetectorPriorityLevel] = {}

    @abc.abstractmethod
    def get_dedupe_value(self, data_packet: DataPacket[PacketT]) -> int:
        """
        Extracts the deduplication value from a passed data packet.
        TODO: This might belong on the `DataPacket` instead.
        """
        pass

    @abc.abstractmethod
    def get_group_key_values(
        self, data_packet: DataPacket[PacketT]
    ) -> dict[DetectorGroupKey, ConditionValueT]:
        """
        Extracts the values for all the group keys that exist in the given data packet,
        and returns then as a dict keyed by group_key.
        """
        pass

    @abc.abstractmethod
    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, new_status: PriorityLevel
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        pass

    def build_fingerprint(self, group_key) -> list[str]:
        """
        Builds a fingerprint to uniquely identify a detected issue

        TODO - Take into account the data source / query that triggered the detector,
        we'll want to create a new issue if the query changes.
        """
        return [f"{self.detector.id}{':' + group_key if group_key is not None else ''}"]

    @property
    def priority_transition_thresholds(self) -> dict[DetectorPriorityLevel, int]:
        """
        Configures how many evaluations of a specific DetectorPriorityLevel
        must occur consecutively in order for the transition to take place.
        DetectorPriorityLevel's that do not need thresholds may be omitted or
        set to zero.
        """
        return {}

    def get_state_data(
        self, group_keys: list[DetectorGroupKey]
    ) -> dict[DetectorGroupKey, DetectorStateData]:
        """
        Fetches state data associated with this detector for the associated `group_keys`.
        Returns a dict keyed by each group_key with the fetched `DetectorStateData`.
        If data isn't currently stored, falls back to default values.
        """
        client = get_redis_client()

        # Get dedupe values for each group key
        pipeline = client.pipeline()
        for dedupe_key in [self.build_dedupe_value_key(gk) for gk in group_keys]:
            pipeline.get(dedupe_key)

        group_key_dedupe_values = {
            gk: int(dv) if dv else 0 for gk, dv in zip(group_keys, pipeline.execute())
        }

        # Get current threshold counts for each group key
        pipeline = client.pipeline()
        threshold_counts: dict[DetectorGroupKey, dict[DetectorPriorityLevel, int]] = {}
        priority_levels = self.priority_transition_thresholds.keys()

        if priority_levels:
            threshold_count_keys = [
                self.build_priority_thresholds_count_key(gk, priority_level)
                for gk in group_keys
                for priority_level in priority_levels
            ]
            for ck in threshold_count_keys:
                pipeline.get(ck)
            vals = [int(val) if val is not None else 0 for val in pipeline.execute()]
            threshold_counts = {
                gk: dict(zip(priority_levels, values))
                for gk, values in zip(group_keys, chunked(vals, len(priority_levels)))
            }

        # Get DetectorState object data
        group_key_detectors = self.bulk_get_detector_state(group_keys)

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
                threshold_counts=threshold_counts.get(gk, {}),
            )
        return results

    def evaluate(
        self, data_packet: DataPacket[PacketT]
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
        value: ConditionValueT,
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

        # TODO 2: Validate that we will never have slow conditions here.
        new_status = DetectorPriorityLevel.OK
        (is_group_condition_met, condition_results), _ = process_data_condition_group(
            self.condition_group.id, value
        )

        if is_group_condition_met:
            validated_condition_results: list[DetectorPriorityLevel] = [
                result
                for result in condition_results
                if result is not None and isinstance(result, DetectorPriorityLevel)
            ]

            new_status = max(new_status, *validated_condition_results)

        # Check and update priority thresholds
        thresholds = self.priority_transition_thresholds
        status_threshold = thresholds.get(new_status, 0)
        current_count = state_data.threshold_counts.get(new_status, 0)

        self.enqueue_threshold_incr(group_key, new_status)

        # Nothing to do if we haven't met the status threshold yet
        if status_threshold and status_threshold > current_count + 1:
            metrics.incr("workflow_engine.detector.priority_threshold_not_met")
            return None

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
                detector_occurrence, event_data = self.build_occurrence_and_event_data(
                    group_key, PriorityLevel(new_status)
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
                is_active=is_active,
                priority=new_status,
                result=result,
                event_data=event_data,
            )
        return None

    def enqueue_dedupe_update(self, group_key: DetectorGroupKey, dedupe_value: int):
        self.dedupe_updates[group_key] = dedupe_value

    def enqueue_state_update(
        self, group_key: DetectorGroupKey, is_active: bool, priority: DetectorPriorityLevel
    ):
        self.state_updates[group_key] = (is_active, priority)

    def enqueue_threshold_incr(self, group_key: DetectorGroupKey, priority: DetectorPriorityLevel):
        self.threshold_incrs[group_key] = priority

    def build_dedupe_value_key(self, group_key: DetectorGroupKey) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:dedupe_value"

    def build_priority_thresholds_count_key(
        self, group_key: DetectorGroupKey, level: DetectorPriorityLevel
    ) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:priority_threshold_count:{level}"

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
        client = get_redis_client()

        # Update dedupe values
        pipeline = client.pipeline()
        if self.dedupe_updates:
            for group_key, dedupe_value in self.dedupe_updates.items():
                pipeline.set(self.build_dedupe_value_key(group_key), dedupe_value, ex=REDIS_TTL)
        pipeline.execute()
        self.dedupe_updates.clear()

        # Update priority threshold incr values
        priority_thresholds = self.priority_transition_thresholds
        if priority_thresholds:
            pipeline = client.pipeline()
            for group_key, priority_to_incr in self.threshold_incrs.items():
                # Reset priority threshold values that are not being incremented
                for priority in set(priority_thresholds.keys()) - {priority_to_incr}:
                    pipeline.delete(self.build_priority_thresholds_count_key(group_key, priority))
                pipeline.incr(self.build_priority_thresholds_count_key(group_key, priority_to_incr))
            pipeline.execute()
            self.threshold_incrs.clear()

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
