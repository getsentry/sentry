from datetime import datetime
from typing import Any, Mapping

from django.conf import settings

from sentry import replaystore
from sentry.replaystore.base import ReplayDataType
from sentry.tasks.base import instrumented_task
from sentry.utils import json, kafka_config, metrics
from sentry.utils.pubsub import KafkaPublisher

ReplayEventType = Mapping[str, Any]


@instrumented_task(  # type: ignore
    name="replays.save_replay",
    queue="replays.save_replay",
    default_retry_delay=5,
    max_retries=5,
    acks_late=True,
)
def save_replay_event(replay_event: ReplayEventType) -> None:
    _save_replay_event(replay_event)


@metrics.wraps("replays.save_replay.save_replay_event")  # type:ignore
def _save_replay_event(replay_event: ReplayEventType) -> None:
    _replaystore_save(replay_event)
    _insert_replay_event(replay_event)


@metrics.wraps("replays.save_replay.stream_insert")  # type:ignore
def _insert_replay_event(replay_event: ReplayEventType) -> None:
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


@metrics.wraps("replays.save_replay._replaystore_save")  # type:ignore
def _replaystore_save(replay_event: ReplayEventType) -> None:
    # TODO: change once init / update distinguished in schema
    is_init = any([i for i in replay_event["data"]["tags"] if i[0] == "isReplayRoot"])
    data_type = ReplayDataType.INIT if is_init else ReplayDataType.EVENT

    replaystore.set_event(
        replay_event["data"]["event_id"],
        replay_event["data"],
        data_type,
        datetime.utcfromtimestamp(replay_event["data"]["timestamp"]),
    )
