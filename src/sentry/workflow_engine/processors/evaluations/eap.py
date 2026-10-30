from __future__ import annotations

import logging
import uuid
from collections.abc import Iterator, Mapping, Sequence
from concurrent.futures import Future
from dataclasses import fields, is_dataclass
from datetime import datetime
from enum import Enum
from functools import partial
from typing import TYPE_CHECKING, overload

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload, KafkaProducer
from arroyo.types import BrokerValue
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
from sentry.utils import json
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.processors.evaluations.base import (
    BaseWorkflowEngineEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.condition import (
    DataConditionEvaluationArtifact,
)
from sentry.workflow_engine.processors.evaluations.serialization import (
    EvaluationEmitter,
    artifact_fields,
)
from sentry.workflow_engine.processors.evaluations.types import WorkflowEngineResult
from sentry.workflow_engine.processors.evaluations.workflow import (
    ProcessWorkflowsResult,
    WorkflowEvaluation,
)
from sentry.workflow_engine.types import WorkflowEventData

if TYPE_CHECKING:
    from sentry.models.organization import Organization


logger = logging.getLogger(__name__)

EVALUATION_NAMESPACE = uuid.UUID("15de19a5-09c3-48d0-80ef-f9ff2c62af57")
EAP_PRODUCER_NAME = "sentry.workflow_engine.evaluations.eap"
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)
EAP_RETENTION_DAYS = 7  # TODO - We'll probably need to store metric issues for longer
type EAPAttributeValue = (
    None
    | bool
    | int
    | float
    | str
    | bytes
    | list["EAPAttributeValue"]
    | dict[str, "EAPAttributeValue"]
)


def _get_eap_items_producer() -> KafkaProducer:
    return get_arroyo_producer(
        name=EAP_PRODUCER_NAME,
        topic=Topic.SNUBA_ITEMS,
    )


# Artifact delivery should be best effort. It should not block task completion or triggering workflow actions
_eap_producer = FutureTrackingProducer(
    name=EAP_PRODUCER_NAME,
    producer_factory=_get_eap_items_producer,
    should_track_futures=False,
    should_backpressure=False,
)


def _workflow_event_attributes(evaluation: WorkflowEvaluation) -> dict[str, object]:
    event_data = evaluation.data["event"]
    event = event_data.event
    group_state: Mapping[str, object] = event_data.group_state or {}

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


def _build_trace_item(
    *,
    organization_id: int,
    project_id: int,
    attributes: Mapping[str, EAPAttributeValue],
    timestamp: Timestamp,
) -> TraceItem:
    correlation_value = (
        attributes.get("event_id") or attributes.get("group_id") or attributes.get("detector_id")
    )
    correlation_id = str(correlation_value)
    trace_id = uuid.uuid5(
        EVALUATION_NAMESPACE,
        f"{organization_id}:{project_id}:{correlation_id}",
    ).hex

    return TraceItem(
        organization_id=organization_id,
        project_id=project_id,
        item_id=hex_to_item_id(uuid.uuid4().hex),
        item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
        timestamp=timestamp,
        received=timestamp,
        trace_id=trace_id,
        retention_days=EAP_RETENTION_DAYS,
        downsampled_retention_days=0,  # Only store the full data, don't down-sample.
        # EAP persists scalars and primitive arrays, not nested protobuf key/value lists.
        attributes={
            key: anyvalue(
                json.dumps(value)
                if key in {"trigger_evaluation", "filter_evaluations", "delayed"}
                else value
            )
            for key, value in attributes.items()
        },
        client_sample_rate=1.0,
        server_sample_rate=1.0,
    )


def _handle_produce_result(
    future: Future[BrokerValue[KafkaPayload]],
    *,
    organization_id: int,
    project_id: int,
) -> None:
    try:
        future.result()
    except Exception:
        logger.exception(
            "workflow_engine.evaluations.eap.delivery_failed",
            extra={"organization_id": organization_id, "project_id": project_id},
        )


def _produce_trace_item(
    *,
    organization_id: int,
    project_id: int,
    topic: ArroyoTopic,
    trace_item: TraceItem,
) -> None:
    payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
    try:
        _eap_producer.produce(
            topic,
            payload,
            callbacks=[
                partial(
                    _handle_produce_result,
                    organization_id=organization_id,
                    project_id=project_id,
                )
            ],
        )
    except Exception:
        logger.exception(
            "workflow_engine.evaluations.eap.produce_failed",
            extra={"organization_id": organization_id, "project_id": project_id},
        )


class EAPEmitter(EvaluationEmitter[dict[str, EAPAttributeValue]]):
    def filter(self, artifact: BaseWorkflowEngineEvaluationArtifact) -> dict[str, object]:
        # Omit absent optional metadata; nulls inside condition input are meaningful and kept.
        data = {
            name: value for name, value in artifact_fields(artifact).items() if value is not None
        }
        if isinstance(artifact, DataConditionEvaluationArtifact):
            data["input"] = self._filter_input(artifact.input)
        return data

    def emit(
        self,
        organization: Organization,
        result: WorkflowEngineResult,
        evaluations: Iterator[dict[str, EAPAttributeValue]],
    ) -> None:
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        timestamp = Timestamp()
        timestamp.FromDatetime(timezone.now())

        for serialized in evaluations:
            # EAP attributes can't be null; nulls are only stored inside JSON attributes.
            attributes = {key: value for key, value in serialized.items() if value is not None}
            if isinstance(result, ProcessWorkflowsResult):
                workflow_id = attributes.get("workflow_id")
                if isinstance(workflow_id, int):
                    evaluation = result.evaluations.get(workflow_id)
                    if evaluation is not None:
                        attributes.update(
                            (key, value)
                            for key, value in self.serialize(
                                _workflow_event_attributes(evaluation)
                            ).items()
                            if value is not None
                        )

            project_id = attributes.get("project_id")
            if not isinstance(project_id, int):
                continue

            trace_item = _build_trace_item(
                organization_id=organization.id,
                project_id=project_id,
                attributes=attributes,
                timestamp=timestamp,
            )
            _produce_trace_item(
                organization_id=organization.id,
                project_id=project_id,
                topic=topic,
                trace_item=trace_item,
            )

    @overload
    def serialize[K](self, value: Mapping[K, object]) -> dict[str, EAPAttributeValue]: ...

    @overload
    def serialize(self, value: object) -> EAPAttributeValue: ...

    def serialize(self, value: object) -> EAPAttributeValue:
        """Convert a filtered value to EAP attribute values, keeping nulls."""
        if value is None:
            return None

        if isinstance(value, Enum):
            return self.serialize(value.value)

        if isinstance(value, datetime):
            return value.isoformat()

        if is_dataclass(value) and not isinstance(value, type):
            return {
                field.name: self.serialize(getattr(value, field.name)) for field in fields(value)
            }

        if isinstance(value, Mapping):
            return {str(key): self.serialize(item) for key, item in value.items()}

        if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            return [self.serialize(item) for item in value]

        if isinstance(value, (bool, int, float, str, bytes)):
            return value

        raise TypeError(f"Unsupported EAP evaluation attribute type: {type(value).__name__}")

    def _filter_input(self, value: object) -> object:
        if not isinstance(value, WorkflowEventData):
            return value

        # Event/group IDs and issue state are already attributes on the TraceItem.
        compact = {
            "group_state": (
                {key: item for key, item in value.group_state.items() if key != "id"}
                if value.group_state is not None
                else None
            ),
            "has_escalated": value.has_escalated,
            "workflow_env": value.workflow_env.id if value.workflow_env is not None else None,
        }
        return {key: item for key, item in compact.items() if item is not None}
