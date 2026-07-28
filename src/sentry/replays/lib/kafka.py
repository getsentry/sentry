from functools import partial

from arroyo.backends.kafka import FutureTrackingProducer, KafkaPayload
from arroyo.types import Topic as ArroyoTopic
from sentry_kafka_schemas.codecs import Codec
from sentry_protos.snuba.v1.trace_item_pb2 import TraceItem
from taskbroker_client.state import current_task
from taskbroker_client.worker.producer import TaskProducer

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.options.rollout import in_random_rollout
from sentry.taskworker.producer import get_task_producer
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer, get_producer
from sentry.utils.kafka_config import get_topic_definition

#
# EAP PRODUCER
#


EAP_ITEMS_CODEC: Codec[TraceItem] = get_topic_codec(Topic.SNUBA_ITEMS)

# The raw-mode taskbroker task that processes ingest-replay-recordings. tasks.py
# references this constant as the task's name so the two can't drift.
PROCESS_REPLAY_RECORDING_TASK_NAME = "sentry.replays.tasks.process_replay_recording"


def _in_process_replay_recording_task() -> bool:
    """Whether we're running inside the ingest-replay-recordings task.

    That task hands its delivery guarantee to the TaskProducer: the worker only
    acks an activation once all of its producer futures succeed, otherwise the
    task is retried. We scope this to the one task by name so we don't change
    delivery behavior for anyone else sharing these producers (the arroyo
    consumer, or any other task that happens to publish).
    """
    task = current_task()
    return task is not None and task.taskname == PROCESS_REPLAY_RECORDING_TASK_NAME


def _get_eap_items_producer(name: str = "sentry.replays.lib.kafka.eap_items"):
    """Get a Kafka producer for EAP TraceItems."""
    return get_arroyo_producer(
        name=name,
        topic=Topic.SNUBA_ITEMS,
    )


eap_producer = SingletonProducer(_get_eap_items_producer)
_eap_task_producer_name = "sentry.replays.lib.kafka.eap_items_ftp"
eap_items_ft_producer = get_producer(
    producer_name=_eap_task_producer_name,
    producer_factory=partial(_get_eap_items_producer, name=_eap_task_producer_name),
)


def write_trace_items(trace_items: list[TraceItem]) -> None:
    """Publish trace-items to the EAP trace-items topic."""
    if _in_process_replay_recording_task() or in_random_rollout(
        "tasks.producer.replays-eap-items.rollout"
    ):
        producer: SingletonProducer | FutureTrackingProducer = eap_items_ft_producer
    else:
        producer = eap_producer
    topic = ArroyoTopic(get_topic_definition(Topic.SNUBA_ITEMS)["real_topic_name"])
    for trace_item in trace_items:
        payload = KafkaPayload(None, EAP_ITEMS_CODEC.encode(trace_item), [])
        producer.produce(topic, payload)


#
# REPLAY PRODUCER
#


def _get_ingest_replay_events_producer(name: str = "sentry.replays.lib.kafka.ingest_replay_events"):
    return get_arroyo_producer(
        name=name,
        topic=Topic.INGEST_REPLAY_EVENTS,
    )


ingest_replay_events_producer = SingletonProducer(_get_ingest_replay_events_producer)
_task_producer_name = "sentry.replays.lib.kafka.ingest_replay_events_taskproducer"
ingest_replay_events_taskproducer = get_task_producer(
    producer_name=_task_producer_name,
    producer_factory=partial(_get_ingest_replay_events_producer, name=_task_producer_name),
)


def publish_replay_event(message: str) -> None:
    """Publishes messages to the ingest-replay-events topic."""
    # Inside the ingest-replay-recordings task we always use the TaskProducer so
    # delivery is tied to the task succeeding. Every other caller keeps the
    # existing rollout-gated behavior.
    if _in_process_replay_recording_task() or (
        current_task() is not None and in_random_rollout("tasks.producer.replays.rollout")
    ):
        producer: SingletonProducer | TaskProducer = ingest_replay_events_taskproducer
    else:
        producer = ingest_replay_events_producer
    producer.produce(
        ArroyoTopic(get_topic_definition(Topic.INGEST_REPLAY_EVENTS)["real_topic_name"]),
        payload=KafkaPayload(None, message.encode("utf-8"), []),
    )
