from datetime import datetime, timezone
from typing import Any, Dict, Mapping, Sequence

import msgpack
from confluent_kafka import Message
from django.conf import settings

from sentry import replaystore
from sentry.replaystore.base import ReplayDataType
from sentry.utils import json, kafka_config, metrics
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils.pubsub import KafkaPublisher

ReplayEventType = Mapping[str, Any]


def get_replay_events_consumer(
    topic: str,
    **options: Dict[str, str],
) -> BatchingKafkaConsumer:
    return create_batching_kafka_consumer(
        {topic},
        worker=ReplayEventsConsumer(),
        **options,
    )


class ReplayEventsConsumer(AbstractBatchWorker):  # type: ignore
    def process_message(self, message: Message) -> Dict[str, Any]:
        message = msgpack.unpackb(message.value(), use_list=False)
        payload = message["payload"]
        project_id = int(message["project_id"])
        start_time = float(message["start_time"])
        data = json.loads(payload)
        data["project"] = int(project_id)
        replay_event = {"data": data, "start_time": start_time}
        return replay_event

    def flush_batch(self, messages: Sequence[Message]) -> None:
        for message in messages:
            _replaystore_save(message)
            _insert_message_snuba_stream(message)

    def shutdown(self) -> None:
        pass


@metrics.wraps("replays.replay_event_consumer._insert_message_snuba_stream")  # type:ignore
def _insert_message_snuba_stream(replay_event: ReplayEventType) -> None:
    replays_config = settings.KAFKA_TOPICS[settings.KAFKA_SNUBA_REPLAY_EVENTS]
    cluster_name = replays_config["cluster"]
    publisher = KafkaPublisher(
        kafka_config.get_kafka_producer_cluster_options(cluster_name), asynchronous=False
    )
    topic_name = replays_config["topic"]
    datetime = replay_event["data"]["timestamp"]
    platform = replay_event["data"]["platform"]
    project_id = replay_event["data"]["project"]
    event_id = replay_event["data"]["event_id"]

    message = {
        "datetime": datetime,
        "platform": platform,
        "project_id": project_id,
        "event_id": event_id,
        "data": replay_event["data"],
        "retention_days": 30,
    }

    publisher.publish(
        topic_name,
        json.dumps(message),
    )


@metrics.wraps("replays.replay_event_consumer._replaystore_save")  # type:ignore
def _replaystore_save(replay_event: ReplayEventType) -> None:
    # TODO: change once init / update distinguished in schema
    is_init = any([i for i in replay_event["data"]["tags"] if i[0] == "isReplayRoot"])
    data_type = ReplayDataType.INIT if is_init else ReplayDataType.EVENT

    replaystore.set_event(
        replay_event["data"]["event_id"],
        replay_event["data"],
        data_type,
        datetime.fromtimestamp(replay_event["data"]["timestamp"], timezone.utc),
    )
