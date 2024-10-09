from __future__ import annotations

import abc
import dataclasses
import logging
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, region_silo_model
from sentry.issues import grouptype
from sentry.models.owner_base import OwnerModel
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import DataPacket

if TYPE_CHECKING:
    from sentry.workflow_engine.models.detector_state import DetectorStatus

logger = logging.getLogger(__name__)


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
    status: DetectorStatus
    # Stateful detectors always process data packets in order. Once we confirm that a data packet has been fully
    # processed and all workflows have been done, this value will be used by the stateful detector to prevent
    # reprocessing
    dedupe_value: int
    # Stateful detectors allow various counts to be tracked. We need to update these after we process workflows, so
    # include the updates in the state
    counter_updates: dict[str, int]


@dataclasses.dataclass(frozen=True)
class DetectorEvaluationResult:
    is_active: bool
    priority: PriorityLevel
    data: Any
    state_update_data: DetectorStateData | None = None


T = TypeVar("T")


class DetectorHandler(abc.ABC, Generic[T]):
    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def evaluate(self, data_packet: DataPacket[T]) -> list[DetectorEvaluationResult]:
        pass
