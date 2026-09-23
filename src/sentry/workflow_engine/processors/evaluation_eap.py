from __future__ import annotations

from collections.abc import Mapping, Sequence
from concurrent.futures import Future
from typing import Any, cast
from uuid import uuid4

from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload
from arroyo.backends.kafka.producer import CloseableProducerProtocol
from arroyo.types import BrokerValue
from arroyo.types import Topic as ArroyoTopic
from django.utils import timezone
from google.protobuf.timestamp_pb2 import Timestamp
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem

from sentry import features, quotas
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.rpc_utils import anyvalue
from sentry.services.eventstore.models import GroupEvent
from sentry.utils import json, metrics
from sentry.utils.arroyo_producer import get_arroyo_producer
from sentry.utils.eap import hex_to_item_id
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.types import WorkflowEventData

EAP_FEATURE = "organizations:workflow-engine-evaluation-artifacts-eap"
EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)
_PRODUCER_NAME = "sentry.workflow_engine.evaluation_eap"


def _get_producer() -> CloseableProducerProtocol:
    # Arroyo's protocol names its first positional argument `dest`, whereas
    # KafkaProducer calls it `destination`. FutureTrackingProducer uses it positionally.
    return cast(
        CloseableProducerProtocol,
        get_arroyo_producer(
            _PRODUCER_NAME,
            Topic.SNUBA_ITEMS,
            use_simple_futures=False,
            additional_config={"queue.buffering.max.messages": 1000},
        ),
    )


# Diagnostic delivery must never make an evaluation task retry. A full queue
# drops the diagnostic rather than waiting for Kafka on the alerting path.
_eap_producer = FutureTrackingProducer(
    name=_PRODUCER_NAME,
    producer_factory=_get_producer,
    should_track_futures=False,
    should_backpressure=False,
)


def get_eap_organization(
    *,
    organization: Organization | None = None,
    organization_id: int | None = None,
    project_id: int | None = None,
) -> Organization | None:
    """Resolve the storage gate before building or serializing any raw inputs."""
    try:
        if organization is None:
            if organization_id is None:
                if project_id is None:
                    return None
                organization_id = Project.objects.get_from_cache(id=project_id).organization_id
            organization = Organization.objects.get_from_cache(id=organization_id)
        if features.has(EAP_FEATURE, organization):
            return organization
    except Exception:
        # Exception messages and locals may contain customer data; report only
        # the failure stage, never the artifact or exception contents.
        metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "gate"})
    return None


def _serialize_value(value: Any) -> Any:
    if isinstance(value, WorkflowEventData):
        event = value.event
        if isinstance(event, GroupEvent):
            event_payload = dict(event.data)
        else:
            event_payload = {
                "id": event.id,
                "project_id": event.project_id,
                "group_id": event.group_id,
                "type": event.type,
                "ident": event.ident,
                "user_id": event.user_id,
                "datetime": event.datetime,
                "data": event.data,
            }
        return _serialize_value(
            {
                "event": event_payload,
                # Snapshot evaluation context without loading deferred fields or
                # traversing ORM relationships. The local query cache is not data.
                "group": {
                    key: value.group.__dict__[key]
                    for key in (
                        "id",
                        "project_id",
                        "type",
                        "status",
                        "substatus",
                        "priority",
                        "first_seen",
                        "last_seen",
                        "times_seen",
                        "data",
                    )
                    if key in value.group.__dict__
                },
                "group_state": value.group_state,
                "has_escalated": value.has_escalated,
                "workflow_env": (
                    {"id": value.workflow_env.id, "name": value.workflow_env.name}
                    if value.workflow_env is not None
                    else None
                ),
            }
        )
    if isinstance(value, Mapping):
        return {key: _serialize_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_serialize_value(item) for item in value]
    # sentry.utils.json already handles dates, UUIDs, and enums. Unsupported
    # objects must fail explicitly, not silently turn into lossy repr strings.
    return value


def _record_delivery(future: Future[BrokerValue[KafkaPayload]]) -> None:
    try:
        future.result()
    except Exception:
        metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "delivery"})
    else:
        metrics.incr("workflow_engine.evaluation_eap.produced")


def produce_evaluation_artifacts(
    organization: Organization, artifacts: Sequence[dict[str, object]]
) -> None:
    """Publish full artifacts selected by the org gate at the emission boundary."""
    try:
        topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
        retention_days = quotas.backend.get_event_retention(organization=organization) or 90
        timestamp = Timestamp()
        timestamp.FromDatetime(timezone.now())
        # These are evaluation records, not spans from the incoming event. Do
        # not mistake an event/activity ID for its trace ID.
        trace_id = uuid4().hex
    except Exception:
        metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "setup"})
        return

    projects: dict[int, Project] = {}
    for artifact in artifacts:
        try:
            project_id = artifact.get("project_id")
            if not isinstance(project_id, int):
                metrics.incr("workflow_engine.evaluation_eap.skipped", tags={"reason": "scope"})
                continue
            if project_id not in projects:
                projects[project_id] = Project.objects.get_from_cache(id=project_id)
            if projects[project_id].organization_id != organization.id:
                metrics.incr("workflow_engine.evaluation_eap.skipped", tags={"reason": "scope"})
                continue
        except Exception:
            metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "scope"})
            continue

        try:
            attributes = {
                key: anyvalue(str(value) if key.endswith("_id") else value)
                for key in (
                    "evaluation_type",
                    "evaluation_phase",
                    "outcome",
                    "triggered",
                    "workflow_id",
                    "detector_id",
                    "detector_type",
                    "event_id",
                    "group_id",
                    "group_key",
                )
                if (value := artifact.get(key)) is not None
            }
            attributes["artifact_schema_version"] = anyvalue(1)
            attributes["artifact"] = anyvalue(
                json.dumps(_serialize_value({**artifact, "organization_id": organization.id}))
            )
            item = TraceItem(
                organization_id=organization.id,
                project_id=project_id,
                item_type=TraceItemType.TRACE_ITEM_TYPE_WORKFLOW_ENGINE_EVALUATION,
                item_id=hex_to_item_id(uuid4().hex),
                trace_id=trace_id,
                timestamp=timestamp,
                received=timestamp,
                retention_days=retention_days,
                client_sample_rate=1.0,
                server_sample_rate=1.0,
                attributes=attributes,
            )
            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(item), [])
        except Exception:
            metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "serialization"})
            continue

        metrics.distribution("workflow_engine.evaluation_eap.payload_size", len(payload.value))
        try:
            _eap_producer.produce(topic, payload, callbacks=[_record_delivery])
        except Exception:
            metrics.incr("workflow_engine.evaluation_eap.failed", tags={"stage": "enqueue"})
