from __future__ import annotations

import logging
import random
import uuid
from collections.abc import Callable, Sequence
from contextlib import suppress
from datetime import UTC, datetime
from logging import Logger
from typing import TYPE_CHECKING, Any, cast

import orjson
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from arroyo.backends.kafka.producer import CloseableProducerProtocol
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import features, options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.search.eap.rpc_utils import anyvalue
from sentry.utils import metrics
from sentry.utils.arroyo_producer import get_arroyo_producer, get_future_tracking_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.utils.sdk import sdk_logger
from sentry.workflow_engine.processors.evaluations.workflow import ProcessWorkflowsResult
from sentry.workflow_engine.utils import WORKFLOW_EVALUATION_NAMESPACE

if TYPE_CHECKING:
    from sentry.models.organization import Organization


WORKFLOW_EVALUATION_LOG_PREFIX = "workflow_engine.process_workflows.evaluation"
WORKFLOW_EVALUATION_EAP_FEATURE = "organizations:workflow-engine-evaluation-eap"
WORKFLOW_EVALUATION_RETENTION_DAYS = 14
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name="sentry.workflow_engine.evaluation_eap",
        topic=Topic.SNUBA_ITEMS,
    )


_eap_producer = get_future_tracking_producer(
    producer_name="sentry.workflow_engine.evaluation_eap",
    producer_factory=cast(Callable[[], CloseableProducerProtocol], _get_eap_items_producer),
)
logger = logging.getLogger(__name__)


def _evaluation_artifacts(result: ProcessWorkflowsResult) -> list[dict[str, Any]]:
    return (
        [evaluation.to_artifact() for evaluation in result.evaluations.values()]
        if result.evaluations
        else [result.to_artifact()]
    )


def should_log(organization: Organization, result: ProcessWorkflowsResult) -> bool:
    if features.has("organizations:workflow-engine-log-evaluations", organization):
        return True
    all_workflow_ids = result.evaluations.keys()
    target_workflow_ids = cast(
        Sequence[int], options.get("workflow_engine.evaluation_log_target_workflow_ids")
    )
    if set(target_workflow_ids).intersection(all_workflow_ids):
        return True
    sample_rate = cast(float, options.get("workflow_engine.evaluation_log_sample_rate"))
    return random.random() < sample_rate


def emit_workflow_evaluation_logs(
    logger: Logger,
    *,
    organization: Organization,
    result: ProcessWorkflowsResult,
    log_prefix: str = WORKFLOW_EVALUATION_LOG_PREFIX,
) -> bool:
    """Sample a batch and emit one self-contained artifact per workflow evaluation."""
    if not should_log(organization, result):
        return False

    direct_to_sentry = options.get("workflow_engine.evaluation_logs_direct_to_sentry")
    for artifact in _evaluation_artifacts(result):
        artifact["organization_id"] = organization.id

        if direct_to_sentry:
            sdk_logger.info(log_prefix, attributes=artifact)
        else:
            logger.info(log_prefix, extra=artifact)

    return True


def _trace_id(event_id: object, project_id: int, group_id: int) -> str:
    if isinstance(event_id, str):
        with suppress(ValueError):
            return uuid.UUID(event_id).hex

    return uuid.uuid5(
        WORKFLOW_EVALUATION_NAMESPACE,
        f"{project_id}:{group_id}:{event_id}",
    ).hex


def _item_id(artifact: dict[str, Any], organization_id: int, evaluated_at: datetime) -> bytes:
    identity = ":".join(
        str(value)
        for value in (
            organization_id,
            artifact.get("project_id"),
            artifact.get("event_id"),
            artifact.get("group_id"),
            artifact.get("detector_id"),
            artifact.get("workflow_id", "batch"),
            evaluated_at.isoformat(),
        )
    )
    return hex_to_item_id(uuid.uuid5(WORKFLOW_EVALUATION_NAMESPACE, identity).hex)


def produce_workflow_evaluations_to_eap(
    *,
    organization_id: int,
    result: ProcessWorkflowsResult,
    evaluated_at: datetime,
) -> bool:
    """Store one self-contained EAP log item per workflow evaluation."""
    timestamp = Timestamp()
    timestamp.FromDatetime(evaluated_at)
    received = Timestamp()
    received.FromDatetime(datetime.now(tz=UTC))

    try:
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        artifacts = _evaluation_artifacts(result)
        observed_timestamp_nanos = int(evaluated_at.timestamp() * 1_000_000_000)
        trace_id = _trace_id(result.event_id, result.project_id, result.group_id)

        for artifact in artifacts:
            artifact["organization_id"] = organization_id
            attributes: dict[str, Any] = {
                "sentry.body": orjson.dumps(artifact).decode(),
                "sentry.severity_number": 9,
                "sentry.severity_text": "INFO",
                "sentry.observed_timestamp_nanos": observed_timestamp_nanos,
                "sentry.timestamp_precise": observed_timestamp_nanos,
                "evaluation_schema_version": 1,
                "evaluation_type": "workflow" if "workflow_id" in artifact else "batch",
                "evaluation_id": artifact.get("evaluation_id"),
                "event_id": artifact.get("event_id"),
                "workflow_id": artifact.get("workflow_id"),
                "group_id": artifact.get("group_id"),
                "detector_id": artifact.get("detector_id"),
                "detector_type": artifact.get("detector_type"),
                "outcome": artifact.get("outcome"),
            }
            trace_item = TraceItem(
                organization_id=organization_id,
                project_id=result.project_id,
                item_id=_item_id(artifact, organization_id, evaluated_at),
                item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
                timestamp=timestamp,
                trace_id=trace_id,
                received=received,
                retention_days=WORKFLOW_EVALUATION_RETENTION_DAYS,
                attributes={
                    key: anyvalue(value) for key, value in attributes.items() if value is not None
                },
                client_sample_rate=1.0,
                server_sample_rate=1.0,
            )
            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
            _eap_producer.produce(topic, payload)

        metrics.incr(
            "workflow_engine.evaluation_eap.produced",
            amount=len(artifacts),
            sample_rate=1.0,
        )
        return True
    except Exception:
        logger.exception("workflow_engine.evaluation_eap.produce_failed")
        metrics.incr("workflow_engine.evaluation_eap.produce_failed", sample_rate=1.0)
        return False


def emit_workflow_evaluations(
    output_logger: Logger,
    *,
    organization: Organization,
    result: ProcessWorkflowsResult,
    evaluated_at: datetime,
) -> bool:
    """Route workflow evaluations to EAP, or retain the sampled logging fallback."""
    if features.has(WORKFLOW_EVALUATION_EAP_FEATURE, organization):
        return produce_workflow_evaluations_to_eap(
            organization_id=organization.id,
            result=result,
            evaluated_at=evaluated_at,
        )

    return emit_workflow_evaluation_logs(
        output_logger,
        organization=organization,
        result=result,
    )
