from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import fields, is_dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.search.eap.rpc_utils import anyvalue
from sentry.services.eventstore.models import GroupEvent
from sentry.types.activity import ActivityType
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.processors.evaluations.condition import (
    DataConditionEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.detector import ProcessDetectorsResult
from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult
from sentry.workflow_engine.processors.evaluations.workflow import (
    ProcessWorkflowsResult,
    WorkflowEvaluation,
    WorkflowEvaluationArtifact,
)

if TYPE_CHECKING:
    from sentry.models.organization import Organization


logger = logging.getLogger(__name__)

EVALUATION_NAMESPACE = uuid.UUID("15de19a5-09c3-48d0-80ef-f9ff2c62af57")
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name="sentry.workflow_engine.evaluations.eap",
        topic=Topic.SNUBA_ITEMS,
    )


_eap_producer = SingletonProducer(_get_eap_items_producer)


def _normalize_value(value: object) -> Any:
    """Convert an evaluation artifact to values supported by EAP's AnyValue."""
    if isinstance(value, Enum):
        return value.value

    if is_dataclass(value) and not isinstance(value, type):
        excluded_fields = (
            {"comparison", "input"} if isinstance(value, DataConditionEvaluationArtifact) else set()
        )
        return {
            field.name: _normalize_value(field_value)
            for field in fields(value)
            if field.name not in excluded_fields
            and (field_value := getattr(value, field.name)) is not None
        }

    if isinstance(value, Mapping):
        return {str(key): _normalize_value(item) for key, item in value.items() if item is not None}

    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_normalize_value(item) for item in value if item is not None]

    return value


def _workflow_event_attributes(evaluation: WorkflowEvaluation) -> dict[str, object]:
    event_data = evaluation.data["event"]
    event = event_data.event
    group_state = event_data.group_state or {}

    attributes: dict[str, object] = {
        "event_kind": "group_event" if isinstance(event, GroupEvent) else "activity",
        "issue_status": event_data.group.status,
        "issue_substatus": event_data.group.substatus,
        "issue_priority": event_data.group.priority,
        "is_resolved": event_data.group.status == GroupStatus.RESOLVED,
    }

    for field_name in ("is_new", "is_regression", "is_new_group_environment"):
        if field_name in group_state:
            attributes[field_name] = group_state[field_name]

    if event_data.has_escalated is not None:
        attributes["has_escalated"] = event_data.has_escalated
    if event_data.workflow_env is not None:
        attributes["environment_id"] = event_data.workflow_env.id

    if isinstance(event, Activity):
        try:
            attributes["activity_type"] = ActivityType(event.type).name.lower()
        except ValueError:
            attributes["activity_type"] = event.type

    return attributes


def _evaluation_attributes(result: WorkflowEngineResult) -> Iterator[dict[str, Any]]:
    artifacts = result.evaluation_artifacts()

    if isinstance(result, ProcessDetectorsResult):
        common = _normalize_value(
            {
                "evaluation_type": "detector",
                "detector_id": result.detector_id,
                "detector_type": result.detector_type,
                "project_id": result.project_id,
            }
        )
        if not artifacts:
            common.update(
                _normalize_value(
                    {
                        "outcome": result.outcome,
                        "error": result.evaluation_error.msg if result.evaluation_error else None,
                    }
                )
            )
            yield common
            return

        for artifact in artifacts:
            yield {**common, **_normalize_value(artifact)}
        return

    if not artifacts:
        if isinstance(result, ProcessWorkflowsResult):
            yield _normalize_value(
                {
                    "evaluation_type": "workflow",
                    "evaluation_phase": result.evaluation_phase,
                    "outcome": result.outcome,
                    "project_id": result.project_id,
                    "group_id": result.group_id,
                    "event_id": result.event_id,
                    "detector_id": result.detector_id,
                    "detector_type": result.detector_type,
                }
            )
        return

    for artifact in artifacts:
        attributes = _normalize_value(artifact)
        if isinstance(result, ProcessWorkflowsResult) and isinstance(
            artifact, WorkflowEvaluationArtifact
        ):
            evaluation = result.evaluations.get(artifact.workflow_id)
            if evaluation is not None:
                attributes.update(_normalize_value(_workflow_event_attributes(evaluation)))
        yield attributes


def emit_evaluation_to_eap(
    organization: Organization,
    result: WorkflowEngineResult,
) -> None:
    """Store compact, queryable workflow-engine evaluation artifacts in EAP."""
    try:
        topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
        timestamp = Timestamp()
        timestamp.FromDatetime(timezone.now())
        retention_days = 7  # TODO - We'll probably need to store metric issues for longer

        for attributes in _evaluation_attributes(result):
            project_id = attributes.get("project_id")
            if not isinstance(project_id, int):
                continue

            correlation_id = (
                attributes.get("event_id")
                or attributes.get("group_id")
                or attributes.get("detector_id")
            )
            trace_id = uuid.uuid5(
                EVALUATION_NAMESPACE,
                f"{organization.id}:{project_id}:{correlation_id}",
            ).hex
            item_id = hex_to_item_id(uuid.uuid4().hex)
            attributes.update(
                {
                    "sentry.body": "workflow_engine.evaluation",
                    "sentry.severity_number": 9,
                    "sentry.severity_text": "INFO",
                }
            )

            trace_item = TraceItem(
                organization_id=organization.id,
                project_id=project_id,
                item_id=item_id,
                item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
                timestamp=timestamp,
                received=timestamp,
                trace_id=trace_id,
                retention_days=retention_days,
                attributes={key: anyvalue(value) for key, value in attributes.items()},
                client_sample_rate=1.0,
                server_sample_rate=1.0,
            )
            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
            _eap_producer.produce(ArroyoTopic(topic), payload)
    except Exception:
        logger.exception(
            "workflow_engine.evaluations.eap.produce_failed",
            extra={"organization_id": organization.id},
        )
