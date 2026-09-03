# pyright: reportMissingImports=false, reportMissingModuleSource=false

from __future__ import annotations

import logging
import uuid
from contextlib import suppress
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

logger = logging.getLogger(__name__)

EVALUATION_EAP_FEATURE = "organizations:workflow-engine-evaluation-eap"
EVALUATION_NAMESPACE = uuid.UUID("b1ad3094-f950-4dfc-9c5a-cf8a3bf43f62")
EVALUATION_RETENTION_DAYS = 14
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer(
    name: str = "sentry.workflow_engine.processors.evaluation_eap",
) -> KafkaProducer:
    return get_arroyo_producer(name=name, topic=Topic.SNUBA_ITEMS)


_eap_producer = get_future_tracking_producer(
    producer_name="sentry.workflow_engine.processors.evaluation_eap",
    producer_factory=_get_eap_items_producer,
)


def _artifact_identity(artifact: dict[str, object], emitted_at: datetime) -> str:
    identity = ":".join(
        str(artifact.get(key) or "")
        for key in (
            "organization_id",
            "project_id",
            "evaluation_type",
            "evaluation_phase",
            "event_id",
            "group_id",
            "detector_id",
            "workflow_id",
            "group_key",
        )
    )
    if artifact.get("event_id") is None:
        return f"{identity}:{emitted_at.isoformat()}"
    return identity


def _trace_id(artifact: dict[str, object], identity: str) -> str:
    event_id = artifact.get("event_id")
    if isinstance(event_id, str):
        with suppress(ValueError):
            return uuid.UUID(event_id).hex
    return uuid.uuid5(EVALUATION_NAMESPACE, identity).hex


def _evaluation_value(artifact: dict[str, object]) -> int | float | None:
    evaluation_value = artifact.get("evaluation_value")
    if isinstance(evaluation_value, (int, float)) and not isinstance(evaluation_value, bool):
        return evaluation_value

    trigger_evaluation = artifact.get("trigger_evaluation")
    if not isinstance(trigger_evaluation, dict):
        return None

    condition_evaluations = trigger_evaluation.get("condition_evaluations")
    if not isinstance(condition_evaluations, list):
        return None

    values = {
        evaluation.get("input")
        for evaluation in condition_evaluations
        if isinstance(evaluation, dict)
        and isinstance(evaluation.get("input"), (int, float))
        and not isinstance(evaluation.get("input"), bool)
    }
    if len(values) != 1:
        return None
    return values.pop()


def build_evaluation_trace_item(
    artifact: dict[str, object],
    *,
    emitted_at: datetime,
) -> TraceItem | None:
    organization_id = artifact.get("organization_id")
    project_id = artifact.get("project_id")
    if not isinstance(organization_id, int) or not isinstance(project_id, int):
        return None

    identity = _artifact_identity(artifact, emitted_at)
    timestamp = Timestamp()
    timestamp.FromDatetime(emitted_at)
    timestamp_nanos = timestamp.seconds * 1_000_000_000 + timestamp.nanos

    has_error = bool(artifact.get("error"))
    severity_number = 17 if has_error else 9
    severity_text = "ERROR" if has_error else "INFO"
    evaluation_type = artifact.get("evaluation_type", "unknown")
    outcome = artifact.get("outcome", "unknown")

    attributes: dict[str, Any] = {
        "sentry.body": f"Workflow engine {evaluation_type} evaluation: {outcome}",
        "sentry.severity_number": severity_number,
        "sentry.severity_text": severity_text,
        "sentry.observed_timestamp_nanos": timestamp_nanos,
        "sentry.timestamp_precise": timestamp_nanos,
        "source": "workflow_engine.evaluation",
        "evaluation_schema_version": 1,
        "evaluation_artifact": orjson.dumps(artifact, option=orjson.OPT_SORT_KEYS).decode(),
        "evaluation_type": evaluation_type,
        "evaluation_phase": artifact.get("evaluation_phase", "initial"),
        "outcome": outcome,
        "detector_id": artifact.get("detector_id"),
        "detector_type": artifact.get("detector_type"),
        "workflow_id": artifact.get("workflow_id"),
        "group_id": artifact.get("group_id"),
        "event_id": artifact.get("event_id"),
        "detector_group_key": artifact.get("group_key"),
        "triggered": artifact.get("triggered"),
        "has_error": has_error,
        "evaluation_value": _evaluation_value(artifact),
    }

    return TraceItem(
        organization_id=organization_id,
        project_id=project_id,
        item_id=hex_to_item_id(uuid.uuid5(EVALUATION_NAMESPACE, identity).hex),
        item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
        timestamp=timestamp,
        received=timestamp,
        trace_id=_trace_id(artifact, identity),
        retention_days=EVALUATION_RETENTION_DAYS,
        attributes={key: anyvalue(value) for key, value in attributes.items() if value is not None},
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )


def produce_evaluation_artifacts_to_eap(
    artifacts: list[dict[str, object]],
    *,
    emitted_at: datetime,
) -> None:
    try:
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        produced = 0
        skipped = 0
        for artifact in artifacts:
            trace_item = build_evaluation_trace_item(artifact, emitted_at=emitted_at)
            if trace_item is None:
                skipped += 1
                continue

            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
            _eap_producer.produce(topic, payload)
            produced += 1

        metrics.incr(
            "workflow_engine.evaluation_eap.produced",
            amount=produced,
            sample_rate=1.0,
        )
        if skipped:
            metrics.incr(
                "workflow_engine.evaluation_eap.skipped",
                amount=skipped,
                sample_rate=1.0,
            )
    except Exception:
        logger.exception("workflow_engine.evaluation_eap.produce_failed")
        metrics.incr("workflow_engine.evaluation_eap.produce_failed", sample_rate=1.0)
