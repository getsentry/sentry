"""
Seer detectors are evaluated by a Seer feature run instead of data conditions.

Evaluation is split across two processes:

1. Dispatch: when a data packet is processed, `evaluate` starts one Seer feature run per
   extracted group value and returns no evaluations.
2. Delivery: Seer pushes the run's result through the feature delivery system
   (`sentry.seer.agent.feature_delivery`), and `deliver_seer_detector_result` completes the
   evaluation with the detector's handler, then hands it to the handler's `on_complete`.

To add a Seer detector:
- Subclass `SeerDetectorHandler`, set `seer_feature_id` to the Seer feature that evaluates it,
  and implement `extract_value`, `evaluate_seer_result`, and `create_seer_occurrence`.
- Register `deliver_seer_detector_result` for that feature id in `DELIVERY_HANDLERS`.
"""

from __future__ import annotations

import abc
import logging
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, ClassVar, Generic, TypedDict, final
from uuid import UUID

from django.db.models import F

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.types import FeatureRunStatus
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun
from sentry.utils import metrics
from sentry.workflow_engine.handlers.detector.base import (
    BaseDetectorHandler,
    DataPacketEvaluationType,
    DataPacketType,
    DetectorEvaluations,
    DetectorOccurrence,
    EventData,
)
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.detector import complete_detector_evaluations
from sentry.workflow_engine.types import DetectorGroupKey

logger = logging.getLogger(__name__)


class SeerDetectorStage(StrEnum):
    """
    The step of a Seer detector evaluation; each emits `workflow_engine.seer_detector.<stage>`.
    """

    # `SeerDetectorHandler.evaluate` starting a Seer feature run
    DISPATCH = "dispatch"
    # `deliver_seer_detector_result` handling the run's result pushed back by Seer
    DELIVERY = "delivery"


class SeerDetectorOutcome(StrEnum):
    """
    Why a stage stopped early; the `outcome` tag on the stage's metric.
    """

    # Dispatch outcomes
    # The organization doesn't have access to Seer
    NO_SEER_ACCESS = "no_seer_access"

    # Delivery outcomes
    # No run mirror (`SeerAgentRun`) matches the delivered run
    MISSING_RUN = "missing_run"
    # Seer's run failed or returned no result
    ERROR = "error"
    # The run mirror's extras weren't written by a Seer detector dispatch
    INVALID_RUN = "invalid_run"
    # The detector was deleted or disabled before delivery
    MISSING_DETECTOR = "missing_detector"


class SeerDetectorRunExtras(TypedDict):
    """
    Stored on the run's `SeerAgentRun.extras` at dispatch, to complete the evaluation on delivery.
    """

    detector_id: int
    data_packet_source_id: str
    group_key: DetectorGroupKey
    value: Any


@dataclass(frozen=True, kw_only=True)
class SeerDetectorResult(Generic[DataPacketEvaluationType]):
    """
    The result Seer delivered for one group's run, with the value that was sent to Seer.
    """

    run_uuid: UUID
    group_key: DetectorGroupKey
    data_packet_source_id: str
    value: DataPacketEvaluationType
    result: dict[str, Any]


class SeerDetectorHandler(BaseDetectorHandler[DataPacketType, DataPacketEvaluationType]):
    """
    Base class for detectors that Seer evaluates.

    Seer decides the outcome, so the base `evaluate` and `create_occurrence` hooks are owned
    by the platform: `evaluate` starts the Seer runs, and `create_occurrence` is never called.
    Subclasses implement the Seer equivalents, which receive Seer's result once it is delivered:

    | Base hook           | Seer hook                | Input                            |
    | ------------------- | ------------------------ | -------------------------------- |
    | `extract_value`     | `extract_value`          | the data packet                  |
    | `evaluate`          | `evaluate_seer_result`   | Seer's result for one group      |
    | `create_occurrence` | `create_seer_occurrence` | the evaluation and Seer's result |

    `extract_value` returns the value Seer evaluates. It is sent to Seer and stored on the run,
    so it MUST be JSON serializable. Return `DetectorGroupValues` to start one run per group.

    `complete_evaluation` turns a delivered result into the evaluation passed to `on_complete`,
    like `_evaluate` does for a data packet.

    Seer detectors MUST be project-scoped.
    """

    # The Seer feature that evaluates this detector; its results are delivered for this id.
    seer_feature_id: ClassVar[str]

    @abc.abstractmethod
    def evaluate_seer_result(
        self, result: SeerDetectorResult[DataPacketEvaluationType]
    ) -> DetectorEvaluation | None:
        """
        Decides the outcome of Seer's result for `result.group_key`, like `evaluate` does for
        an extracted value:

        1. Triggered: `DetectorEvaluation.create_issue(result.group_key, priority)`. The platform
           calls `create_seer_occurrence` and sets the built `IssueOccurrence` as the result.
        2. Already built: `evaluation.with_result(result)`, e.g. a `StatusChangeMessage`.
        3. Nothing to do: return None, or `DetectorEvaluation.ok(result.group_key)`.
        """
        pass

    @abc.abstractmethod
    def create_seer_occurrence(
        self,
        evaluation: DetectorEvaluation,
        result: SeerDetectorResult[DataPacketEvaluationType],
    ) -> tuple[DetectorOccurrence, EventData]:
        """
        Builds the occurrence for an evaluation `evaluate_seer_result` triggered, like
        `create_occurrence` does for a data packet.

        The event id defaults to the run's UUID, so a redelivered result produces the same
        occurrence id.
        """
        pass

    @final
    def evaluate(
        self,
        data_packet: DataPacket[DataPacketType],
        values: Mapping[DetectorGroupKey, DataPacketEvaluationType],
    ) -> DetectorEvaluations:
        """
        Starts a Seer feature run for each group's value. The outcome is decided once Seer
        delivers the result, so there are no evaluations to return.
        """
        no_evaluations = DetectorEvaluations(evaluations={}, tainted=False)

        if self.detector.project_id is None:
            raise ValueError(f"Seer detector {self.detector.id} is not project-scoped")

        project = Project.objects.get_from_cache(id=self.detector.project_id)
        organization = Organization.objects.get_from_cache(id=project.organization_id)

        try:
            client = SeerAgentClient(organization, project=project)
        except SeerPermissionError:
            _incr(
                SeerDetectorStage.DISPATCH, SeerDetectorOutcome.NO_SEER_ACCESS, self.detector.type
            )
            return no_evaluations

        for group_key, value in values.items():
            extras = SeerDetectorRunExtras(
                detector_id=self.detector.id,
                data_packet_source_id=data_packet.source_id,
                group_key=group_key,
                value=value,
            )
            client.start_feature_run(
                feature_id=self.seer_feature_id,
                payload={
                    **extras,
                    "detector_type": self.detector.type,
                    "project_id": project.id,
                    "config": self.detector.config,
                },
                title=f"Detector evaluation: {self.detector.name}",
                referrer=self.seer_feature_id,
                flush=False,
                extras=dict(extras),
            )

        return no_evaluations

    @final
    def create_occurrence(
        self,
        evaluation: DetectorEvaluation,
        data_packet: DataPacket[DataPacketType],
    ) -> tuple[DetectorOccurrence, EventData]:
        # `evaluate` never triggers, so the platform never builds an occurrence from a packet.
        raise NotImplementedError(
            "Seer detectors build occurrences from Seer's result in `create_seer_occurrence`"
        )

    @final
    def complete_evaluation(
        self, result: SeerDetectorResult[DataPacketEvaluationType]
    ) -> dict[DetectorGroupKey, DetectorEvaluation]:
        """
        Turns Seer's result into the evaluation passed to `on_complete`, like `_evaluate` does for
        a data packet. Returns nothing when the result has no outcome.
        """
        evaluation = self.evaluate_seer_result(result)

        if evaluation is None:
            return {}

        if evaluation.data["group_key"] != result.group_key:
            raise ValueError(
                f"Detector {self.detector.id} `evaluate_seer_result` returned group key "
                f"{evaluation.data['group_key']!r} for a run of group key {result.group_key!r}"
            )

        if evaluation.needs_occurrence:
            detector_occurrence, event_data = self.create_seer_occurrence(evaluation, result)
            evaluation = self._with_occurrence(
                evaluation,
                detector_occurrence,
                {"event_id": result.run_uuid.hex, **event_data},
                result.data_packet_source_id,
                result.value,
            )
        elif evaluation.result is None:
            return {}

        return {result.group_key: evaluation}


def deliver_seer_detector_result(
    organization_id: int,
    run_uuid: UUID,
    status: FeatureRunStatus,
    result: dict[str, Any] | None,
    error: str | None,
    prompt_version: str | None = None,
) -> None:
    """
    The `FeatureDeliveryFn` for Seer detectors: completes the evaluation a
    `SeerDetectorHandler` dispatched, and hands it to the handler's `on_complete`.

    Delivery happens outside `process_detectors`, so the cases where it stops early emit
    `workflow_engine.seer_detector.delivery`, tagged with the delivery `SeerDetectorOutcome`.

    Completed evaluations are reported by `complete_detector_evaluations`.
    """
    agent_run = (
        SeerAgentRun.objects.filter(run__organization_id=organization_id, run__uuid=run_uuid)
        .select_related("run")
        .first()
    )

    if agent_run is None:
        _incr(SeerDetectorStage.DELIVERY, SeerDetectorOutcome.MISSING_RUN)
        return

    if status != "completed" or result is None:
        _incr(SeerDetectorStage.DELIVERY, SeerDetectorOutcome.ERROR)
        logger.warning(
            "seer_detector.delivery.no_result",
            extra={
                "organization_id": organization_id,
                "run_uuid": str(run_uuid),
                "feature_id": agent_run.source,
                "status": status,
                "error": error,
            },
        )
        return

    try:
        extras = SeerDetectorRunExtras(
            detector_id=agent_run.extras["detector_id"],
            data_packet_source_id=agent_run.extras["data_packet_source_id"],
            group_key=agent_run.extras["group_key"],
            value=agent_run.extras["value"],
        )
    except KeyError:
        _incr(SeerDetectorStage.DELIVERY, SeerDetectorOutcome.INVALID_RUN)
        return

    detector = (
        Detector.objects.filter(
            id=extras["detector_id"],
            project__organization_id=organization_id,
            enabled=True,
        )
        # `complete_detector_evaluations` stores the evaluations under the detector's organization
        .annotate(project_organization_id=F("project__organization_id"))
        .first()
    )

    if detector is None:
        _incr(SeerDetectorStage.DELIVERY, SeerDetectorOutcome.MISSING_DETECTOR)
        return

    handler = detector.detector_handler

    if not isinstance(handler, SeerDetectorHandler) or handler.seer_feature_id != agent_run.source:
        logger.error(
            "seer_detector.delivery.invalid_handler",
            extra={
                "detector_id": detector.id,
                "detector_type": detector.type,
                "feature_id": agent_run.source,
            },
        )
        return

    evaluations = handler.complete_evaluation(
        SeerDetectorResult(
            run_uuid=run_uuid,
            group_key=extras["group_key"],
            data_packet_source_id=extras["data_packet_source_id"],
            value=extras["value"],
            result=result,
        )
    )
    complete_detector_evaluations(detector, handler, evaluations)


def _incr(
    stage: SeerDetectorStage, outcome: SeerDetectorOutcome, detector_type: str | None = None
) -> None:
    metrics.incr(
        f"workflow_engine.seer_detector.{stage}",
        tags={"detector_type": detector_type, "outcome": outcome},
        sample_rate=1.0,
    )
