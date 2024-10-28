from __future__ import annotations

import abc
import dataclasses
import logging
from datetime import timedelta
from typing import Any, Generic, TypeVar

from django.conf import settings
from django.db import models
from django.db.models import Q, UniqueConstraint
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.issues import grouptype
from sentry.models.owner_base import OwnerModel
from sentry.utils import redis
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.detector_state import DetectorState
from sentry.workflow_engine.types import DetectorPriorityLevel

logger = logging.getLogger(__name__)


REDIS_TTL = int(timedelta(days=7).total_seconds())


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]


@region_silo_model
class Detector(DefaultFieldsModel, OwnerModel):
    __relocation_scope__ = RelocationScope.Organization

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=200)

    # The data sources that the detector is watching
    data_sources = models.ManyToManyField(
        "workflow_engine.DataSource", through="workflow_engine.DataSourceDetector"
    )

    # The conditions that must be met for the detector to be considered 'active'
    # This will emit an event for the workflow to process
    workflow_condition_group = FlexibleForeignKey(
        "workflow_engine.DataConditionGroup",
        blank=True,
        null=True,
        unique=True,
        on_delete=models.SET_NULL,
    )
    type = models.CharField(max_length=200)

    class Meta(OwnerModel.Meta):
        constraints = OwnerModel.Meta.constraints + [
            UniqueConstraint(
                fields=["organization", "name"],
                name="workflow_engine_detector_org_name",
            )
        ]

    @property
    def detector_handler(self) -> DetectorHandler | None:
        group_type = grouptype.registry.get_by_slug(self.type)
        if not group_type:
            logger.error(
                "No registered grouptype for detector",
                extra={
                    "group_type": str(group_type),
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None

        if not group_type.detector_handler:
            logger.error(
                "Registered grouptype for detector has no detector_handler",
                extra={
                    "group_type": str(group_type),
                    "detector_id": self.id,
                    "detector_type": self.type,
                },
            )
            return None
        return group_type.detector_handler(self)


@dataclasses.dataclass(frozen=True)
class DetectorStateData:
    group_key: str | None
    active: bool
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


@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    is_active: bool
    priority: DetectorPriorityLevel
    data: Any
    state_update_data: DetectorStateData | None = None


T = TypeVar("T")


class DetectorHandler(abc.ABC, Generic[T]):
    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def evaluate(self, data_packet: DataPacket[T]) -> list[DetectorEvaluationResult]:
        pass


class StatefulDetectorHandler(DetectorHandler[T], abc.ABC):
    def build_dedupe_value_key(self, group_key: str | None) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:dedupe_value"

    def build_counter_value_key(self, group_key: str | None, counter_name: str) -> str:
        if group_key is None:
            group_key = ""
        return f"{self.detector.id}:{group_key}:{counter_name}"

    def bulk_get_detector_state(
        self, state_updates: list[DetectorStateData]
    ) -> dict[str | None, DetectorState]:
        group_keys = {update.group_key for update in state_updates}
        query_filter = Q(
            detector_group_key__in=[group_key for group_key in group_keys if group_key is not None]
        )
        if None in group_keys:
            query_filter |= Q(detector_group_key__isnull=True)

        return {
            detector_state.detector_group_key: detector_state
            for detector_state in self.detector.detectorstate_set.filter(query_filter)
        }

    def commit_state_update_data(self, state_updates: list[DetectorStateData]):
        self._bulk_commit_detector_state(state_updates)
        self._bulk_commit_redis_state(state_updates)

    def _bulk_commit_redis_state(self, state_updates: list[DetectorStateData]):
        dedupe_values = []
        group_counter_updates = {}
        for state_update in state_updates:
            dedupe_values.append((state_update.group_key, state_update.dedupe_value))
            group_counter_updates[state_update.group_key] = state_update.counter_updates

        pipeline = get_redis_client().pipeline()
        if dedupe_values:
            for group_key, dedupe_value in dedupe_values:
                pipeline.set(self.build_dedupe_value_key(group_key), dedupe_value, ex=REDIS_TTL)

        if group_counter_updates:
            for group_key, counter_updates in group_counter_updates.items():
                for counter_name, counter_value in counter_updates.items():
                    key_name = self.build_counter_value_key(group_key, counter_name)
                    if counter_value is None:
                        pipeline.delete(key_name)
                    else:
                        pipeline.set(key_name, counter_value, ex=REDIS_TTL)

        pipeline.execute()

    def _bulk_commit_detector_state(self, state_updates: list[DetectorStateData]):
        detector_state_lookup = self.bulk_get_detector_state(state_updates)
        created_detector_states = []
        updated_detector_states = []
        for state_update in state_updates:
            detector_state = detector_state_lookup.get(state_update.group_key)
            if not detector_state:
                created_detector_states.append(
                    DetectorState(
                        detector_group_key=state_update.group_key,
                        detector=self.detector,
                        active=state_update.active,
                        state=state_update.status,
                    )
                )
            elif (
                state_update.active != detector_state.active
                or state_update.status != detector_state.state
            ):
                detector_state.active = state_update.active
                detector_state.state = state_update.status
                updated_detector_states.append(detector_state)

        if created_detector_states:
            DetectorState.objects.bulk_create(created_detector_states)

        if updated_detector_states:
            DetectorState.objects.bulk_update(updated_detector_states, ["active", "state"])
