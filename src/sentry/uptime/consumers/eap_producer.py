import logging
from functools import partial

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.uptime_results_v1 import CheckResult
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem
from taskbroker_client.state import current_task
from taskbroker_client.worker.producer import TaskProducer

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.options.rollout import in_random_rollout
from sentry.taskworker.producer import get_task_producer
from sentry.uptime.consumers.eap_converter import convert_uptime_result_to_trace_items
from sentry.uptime.types import IncidentStatus
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)

EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)


def _get_eap_items_producer(name: str = "sentry.uptime.consumers.eap_producer"):
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        name,
        Topic.SNUBA_ITEMS,
        exclude_config_keys=["compression.type", "message.max.bytes"],
    )


_eap_items_producer = SingletonProducer(_get_eap_items_producer)
_eap_tp_name = "sentry.uptime.consumers.eap.taskproducer"
_eap_items_taskproducer = get_task_producer(
    producer_name=_eap_tp_name, producer_factory=partial(_get_eap_items_producer, name=_eap_tp_name)
)


def _get_producer() -> TaskProducer | SingletonProducer:
    if current_task() is not None and in_random_rollout("tasks.producer.uptime.rollout"):
        return _eap_items_taskproducer
    return _eap_items_producer


def produce_eap_uptime_result(
    detector: Detector,
    result: CheckResult,
    metric_tags: dict[str, str],
) -> None:
    """
    Produces TraceItems to the EAP topic for uptime check results.

    Uses the converter to create TraceItems and publishes them to the
    snuba-items topic for EAP ingestion.
    """
    try:
        detector_state = detector.detectorstate_set.first()
        if detector_state and detector_state.is_triggered:
            incident_status = IncidentStatus.IN_INCIDENT
        else:
            incident_status = IncidentStatus.NO_INCIDENT

        trace_items = convert_uptime_result_to_trace_items(
            detector.project, result, incident_status
        )
        topic = get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"]
        producer = _get_producer()

        for trace_item in trace_items:
            payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
            producer.produce(ArroyoTopic(topic), payload)

        metrics.incr(
            "uptime.result_processor.eap_message_produced",
            sample_rate=1.0,
            tags={**metric_tags, "count": str(len(trace_items))},
        )

        logger.debug(
            "Produced EAP TraceItems for uptime result",
            extra={
                "subscription_id": result["subscription_id"],
                "check_status": result["status"],
                "region": result["region"],
                "project_id": detector.project.id,
                "trace_item_count": len(trace_items),
                "incident_status": incident_status.value,
            },
        )

    except Exception:
        logger.exception("Failed to produce EAP TraceItems for uptime result")
        metrics.incr(
            "uptime.result_processor.eap_message_failed",
            sample_rate=1.0,
            tags=metric_tags,
        )
