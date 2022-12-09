import logging
from typing import Any, Callable, Mapping, Optional

from arroyo import Topic
from arroyo.backends.kafka.configuration import build_kafka_consumer_configuration
from arroyo.backends.kafka.consumer import KafkaConsumer, KafkaPayload
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.types import Message, Partition, Position
from django.conf import settings

from sentry.eventstore.models import Event
from sentry.issues.issue_occurrence import IssueOccurrenceData  # IssueOccurrence
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.kafka_config import get_kafka_consumer_cluster_options

_DURATION_METRIC = "occurrence_ingest.duration"
_MESSAGES_METRIC = "occurrence_ingest.messages"

logger = logging.getLogger(__name__)


def get_occurrences_ingest_consumer(
    consumer_type: str,
) -> StreamProcessor[KafkaPayload]:
    return create_ingest_occurences_consumer(consumer_type)


def create_ingest_occurences_consumer(
    topic_name: str, **options: Any
) -> StreamProcessor[KafkaPayload]:

    consumer = KafkaConsumer(
        build_kafka_consumer_configuration(
            get_kafka_consumer_cluster_options(settings.KAFKA_TOPICS[topic_name]["cluster"]),
            auto_offset_reset="latest",
            group_id="occurrence-consumer",
        )
    )

    strategy_factory = OccurrenceStrategyFactory()

    return StreamProcessor(
        consumer,
        Topic(topic_name),
        strategy_factory,
        ONCE_PER_SECOND,
    )


@instrumented_task(  # type: ignore
    name="sentry.tasks.store.save_event_occurrence",
    queue="events.save_event_occurrence",
    time_limit=65,
    soft_time_limit=60,
)
def save_event_occurrence(
    data: Optional[Event] = None,
    start_time: Optional[int] = None,
    **kwargs: Any,
) -> Optional[Event]:

    from sentry.event_manager import EventManager

    event_type = "platform"

    with metrics.global_tags(event_type=event_type):
        if data is not None:
            data = CanonicalKeyDict(data)

            with metrics.timer("occurrence_consumer.save_event_occurrence.event_manager.save"):
                manager = EventManager(data)
                event = manager.save()

                return event

    return None


def dispatch_process_event_and_issue_occurrence_task(
    occurrence_data: IssueOccurrenceData, event_data: Any  # EventData
) -> None:
    # event = save_event_occurrence(event_data)
    # if not event:
    #    # event failed to save
    #    return
    # save_issue_occurrence(occurrence_data, event)
    pass


def dispatch_process_issue_occurrence_task(
    occurrence_data: IssueOccurrenceData,
) -> None:
    # event = occurrence_data.event_id  # TODO get Event object here
    # save_issue_occurrence(**kwargs, event)
    pass


def get_task_kwargs_for_message(value: bytes) -> Optional[Mapping[str, Any]]:
    metrics.timing("occurrence.ingest.size.data", len(value))
    payload = json.loads(value, use_rapid_json=True)

    kwargs = {
        payload
        # TODO validate payload here
    }

    return kwargs


def _get_task_kwargs(message: Message[KafkaPayload]) -> Optional[Mapping[str, Any]]:
    with metrics.timer(_DURATION_METRIC, instance="get_task_kwargs_for_message"):
        return get_task_kwargs_for_message(message.payload.value)


def _get_task_kwargs_and_dispatch(message: Message[KafkaPayload]) -> None:
    task_kwargs = _get_task_kwargs(message)
    if not task_kwargs:
        return None

    metrics.incr(
        _MESSAGES_METRIC,
        amount=1,
        tags={},  # TODO
        sample_rate=1,
    )

    if "event_data" in task_kwargs:
        dispatch_process_event_and_issue_occurrence_task(**task_kwargs)
    else:
        dispatch_process_issue_occurrence_task(**task_kwargs)


class OccurrenceStrategy(ProcessingStrategy[KafkaPayload]):
    def __init__(
        self,
        committer: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ):
        pass

    def poll(self) -> None:
        pass

    def submit(self, message: Message[KafkaPayload]) -> None:
        logger.info(f"OCCURRENCE RECEIVED: {message.payload.value}")
        _get_task_kwargs_and_dispatch(message)

    def close(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        pass


class OccurrenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Callable[[Mapping[Partition, Position]], None],
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return OccurrenceStrategy(commit, partitions)
