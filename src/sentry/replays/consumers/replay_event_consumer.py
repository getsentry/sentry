from typing import Any, Dict, Sequence

import msgpack
from confluent_kafka import Message

from sentry.replays.tasks import save_replay_event
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import AbstractBatchWorker, BatchingKafkaConsumer
from sentry.utils.kafka import create_batching_kafka_consumer


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
            process_replay_event(message)

    def shutdown(self) -> None:
        pass


def process_replay_event(replay_event: Any) -> None:
    save_replay_event.s(replay_event).apply_async()
