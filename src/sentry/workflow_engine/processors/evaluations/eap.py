from __future__ import annotations

import logging
import uuid
from collections.abc import Sequence
from contextlib import suppress
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Any

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils import metrics
from sentry.utils.arroyo_producer import get_arroyo_producer, get_future_tracking_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.processors.evaluations.base import EvaluationPhase, EvaluationType
from sentry.workflow_engine.processors.evaluations.detector import (
    DetectorEvaluationArtifact,
    DetectorEvaluationOutcome,
    ProcessDetectorsResult,
)
from sentry.workflow_engine.processors.evaluations.workflow import (
    ProcessWorkflowsResult,
    WorkflowEvaluationArtifact,
    WorkflowEvaluationOutcome,
)
from sentry.workflow_engine.types import DetectorGroupKey

logger = logging.getLogger(__name__)

EVALUATION_EAP_FEATURE = "organizations:workflow-engine-evaluation-eap"
EVALUATION_NAMESPACE = uuid.UUID("b1ad3094-f950-4dfc-9c5a-cf8a3bf43f62")
EVALUATION_RETENTION_DAYS = 14
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)

type EvaluationArtifact = DetectorEvaluationArtifact | WorkflowEvaluationArtifact
type EvaluationOutcome = DetectorEvaluationOutcome | WorkflowEvaluationOutcome
type SerializedEvaluationArtifact = dict[str, Any]


@dataclass(frozen=True)
class EvaluationArtifactContext:
    organization_id: int
    project_id: int | None
    evaluation_type: EvaluationType
    evaluation_phase: EvaluationPhase
    outcome: EvaluationOutcome
    detector_id: int | None
    detector_type: str | None
    error: str | None
    event_id: str | None = None
    workflow_id: int | None = None
    group_id: int | None = None
    group_key: DetectorGroupKey = None


@dataclass(frozen=True)
class EvaluationArtifactItem:
    context: EvaluationArtifactContext
    artifact: EvaluationArtifact | None


def _get_eap_items_producer(
    name: str = "sentry.workflow_engine.processors.evaluations.eap",
) -> KafkaProducer:
    return get_arroyo_producer(name=name, topic=Topic.SNUBA_ITEMS)


_eap_producer = get_future_tracking_producer(
    producer_name="sentry.workflow_engine.processors.evaluations.eap",
    producer_factory=_get_eap_items_producer,
)


def _artifact_identity(item: EvaluationArtifactItem, emitted_at: datetime) -> str:
    context = item.context
    identity = ":".join(
        str(value or "")
        for value in (
            context.organization_id,
            context.project_id,
            context.evaluation_type,
            context.evaluation_phase,
            context.event_id,
            context.group_id,
            context.detector_id,
            context.workflow_id,
            context.group_key,
        )
    )
    return identity if context.event_id is not None else f"{identity}:{emitted_at.isoformat()}"


def _trace_id(event_id: str | None, identity: str) -> str:
    if event_id is not None:
        with suppress(ValueError):
            return uuid.UUID(event_id).hex
    return uuid.uuid5(EVALUATION_NAMESPACE, identity).hex


def _evaluation_value(artifact: EvaluationArtifact | None) -> int | float | None:
    if artifact is None:
        return None

    unique_values = {
        evaluation.input
        for evaluation in artifact.trigger_evaluation.condition_evaluations
        if isinstance(evaluation.input, (int, float)) and not isinstance(evaluation.input, bool)
    }
    return next(iter(unique_values)) if len(unique_values) == 1 else None


def _serialize_artifact(item: EvaluationArtifactItem) -> SerializedEvaluationArtifact:
    context = item.context
    if isinstance(item.artifact, WorkflowEvaluationArtifact):
        serialized = asdict(item.artifact)
    elif isinstance(item.artifact, DetectorEvaluationArtifact):
        serialized = {
            "evaluation_type": context.evaluation_type,
            "detector_id": context.detector_id,
            "detector_type": context.detector_type,
            "project_id": context.project_id,
            "outcome": context.outcome,
            **asdict(item.artifact),
        }
    elif context.evaluation_type == EvaluationType.DETECTOR:
        serialized = {
            "evaluation_type": context.evaluation_type,
            "detector_id": context.detector_id,
            "detector_type": context.detector_type,
            "project_id": context.project_id,
            "outcome": context.outcome,
            "error": context.error,
        }
    else:
        serialized = {
            "detector_id": context.detector_id,
            "detector_type": context.detector_type,
            "error": context.error,
            "evaluation_phase": context.evaluation_phase,
            "evaluation_type": context.evaluation_type,
            "event_id": context.event_id,
            "group_id": context.group_id,
            "outcome": context.outcome,
            "project_id": context.project_id,
        }
    serialized["organization_id"] = context.organization_id
    return serialized


def build_evaluation_trace_item(
    item: EvaluationArtifactItem,
    *,
    emitted_at: datetime,
) -> TraceItem | None:
    context = item.context
    if context.project_id is None:
        return None

    identity = _artifact_identity(item, emitted_at)
    timestamp = Timestamp()
    timestamp.FromDatetime(emitted_at)
    timestamp_nanos = timestamp.seconds * 1_000_000_000 + timestamp.nanos
    has_error = bool(context.error)

    attributes: dict[str, Any] = {
        "sentry.body": (f"Workflow engine {context.evaluation_type} evaluation: {context.outcome}"),
        "sentry.severity_number": 17 if has_error else 9,
        "sentry.severity_text": "ERROR" if has_error else "INFO",
        "sentry.observed_timestamp_nanos": timestamp_nanos,
        "sentry.timestamp_precise": timestamp_nanos,
        "source": "workflow_engine.evaluation",
        "evaluation_schema_version": 1,
        "evaluation_artifact": orjson.dumps(
            _serialize_artifact(item), option=orjson.OPT_SORT_KEYS
        ).decode(),
        "evaluation_type": context.evaluation_type,
        "evaluation_phase": context.evaluation_phase,
        "outcome": context.outcome,
        "detector_id": context.detector_id,
        "detector_type": context.detector_type,
        "workflow_id": context.workflow_id,
        "group_id": context.group_id,
        "event_id": context.event_id,
        "detector_group_key": context.group_key,
        "triggered": item.artifact.triggered if item.artifact is not None else None,
        "has_error": has_error,
        "evaluation_value": _evaluation_value(item.artifact),
    }

    return TraceItem(
        organization_id=context.organization_id,
        project_id=context.project_id,
        item_id=hex_to_item_id(uuid.uuid5(EVALUATION_NAMESPACE, identity).hex),
        item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
        timestamp=timestamp,
        received=timestamp,
        trace_id=_trace_id(context.event_id, identity),
        retention_days=EVALUATION_RETENTION_DAYS,
        attributes={key: anyvalue(value) for key, value in attributes.items() if value is not None},
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )


def produce_evaluation_artifacts_to_eap(
    items: Sequence[EvaluationArtifactItem], emitted_at: datetime
) -> None:
    try:
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        produced = 0
        skipped = 0
        for item in items:
            trace_item = build_evaluation_trace_item(item, emitted_at=emitted_at)
            if trace_item is None:
                skipped += 1
                continue

            _eap_producer.produce(
                topic,
                KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), []),
            )
            produced += 1

        metrics.incr("workflow_engine.evaluation_eap.produced", amount=produced, sample_rate=1.0)
        if skipped:
            metrics.incr("workflow_engine.evaluation_eap.skipped", amount=skipped, sample_rate=1.0)
    except Exception:
        logger.exception("workflow_engine.evaluation_eap.produce_failed")
        metrics.incr("workflow_engine.evaluation_eap.produce_failed", sample_rate=1.0)


def produce_detector_evaluation_artifacts_to_eap(
    result: ProcessDetectorsResult,
    *,
    organization_id: int,
    emitted_at: datetime,
) -> None:
    if result.evaluations:
        items = []
        for evaluation in result.evaluations.values():
            artifact = evaluation.to_artifact()
            items.append(
                EvaluationArtifactItem(
                    context=EvaluationArtifactContext(
                        organization_id=organization_id,
                        project_id=result.project_id,
                        evaluation_type=EvaluationType.DETECTOR,
                        evaluation_phase=EvaluationPhase.INITIAL,
                        outcome=evaluation.outcome,
                        detector_id=result.detector_id,
                        detector_type=result.detector_type,
                        error=artifact.error,
                        event_id=artifact.event_id,
                        group_key=artifact.group_key,
                    ),
                    artifact=artifact,
                )
            )
    else:
        items = [
            EvaluationArtifactItem(
                context=EvaluationArtifactContext(
                    organization_id=organization_id,
                    project_id=result.project_id,
                    evaluation_type=EvaluationType.DETECTOR,
                    evaluation_phase=EvaluationPhase.INITIAL,
                    outcome=result.outcome,
                    detector_id=result.detector_id,
                    detector_type=result.detector_type,
                    error=(result.evaluation_error.msg if result.evaluation_error else None),
                ),
                artifact=None,
            )
        ]
    produce_evaluation_artifacts_to_eap(items, emitted_at)


def produce_workflow_evaluation_artifacts_to_eap(
    result: ProcessWorkflowsResult | Sequence[WorkflowEvaluationArtifact],
    *,
    organization_id: int,
    emitted_at: datetime,
) -> None:
    if isinstance(result, ProcessWorkflowsResult):
        artifacts: Sequence[WorkflowEvaluationArtifact] = [
            evaluation.to_artifact() for evaluation in result.evaluations.values()
        ]
        if not artifacts:
            produce_evaluation_artifacts_to_eap(
                [
                    EvaluationArtifactItem(
                        context=EvaluationArtifactContext(
                            organization_id=organization_id,
                            project_id=result.project_id,
                            evaluation_type=EvaluationType.WORKFLOW,
                            evaluation_phase=EvaluationPhase.INITIAL,
                            outcome=result.outcome,
                            detector_id=result.detector_id,
                            detector_type=result.detector_type,
                            error=None,
                            event_id=result.event_id,
                            group_id=result.group_id,
                        ),
                        artifact=None,
                    )
                ],
                emitted_at,
            )
            return
    else:
        artifacts = result

    produce_evaluation_artifacts_to_eap(
        [
            EvaluationArtifactItem(
                context=EvaluationArtifactContext(
                    organization_id=organization_id,
                    project_id=artifact.project_id,
                    evaluation_type=artifact.evaluation_type,
                    evaluation_phase=artifact.evaluation_phase,
                    outcome=artifact.outcome,
                    detector_id=artifact.detector_id,
                    detector_type=artifact.detector_type,
                    error=artifact.error,
                    event_id=artifact.event_id,
                    workflow_id=artifact.workflow_id,
                    group_id=artifact.group_id,
                ),
                artifact=artifact,
            )
            for artifact in artifacts
        ],
        emitted_at,
    )
