from datetime import timedelta
from typing import Any, Mapping, Optional, Set, Union

from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies.streaming import KafkaConsumerStrategyFactory
from arroyo.processing.strategies.streaming.factory import StreamMessageFilter
from django.utils import timezone

from sentry.sentry_metrics.indexer.base import FetchType
from sentry.sentry_metrics.indexer.models import StringIndexer
from sentry.sentry_metrics.multiprocess import get_config, logger
from sentry.utils import json

MAPPING_META = "mapping_meta"


class LastSeenUpdaterMessageFilter(StreamMessageFilter[KafkaPayload]):  # type: ignore
    # We want to ignore messages where the mapping_sources header is present
    # and does not contain the DB_READ ('d') character (this should be the vast
    # majority of messages).
    def should_drop(self, message: KafkaPayload) -> bool:
        header_value: Optional[str] = next(
            (str(header[1]) for header in message.headers if header[0] == "mapping_sources"), None
        )
        if not header_value:
            return False

        return FetchType.DB_READ.value not in str(header_value)


def _update_stale_last_seen(seen_ints: Set[int]) -> Any:
    return StringIndexer.objects.filter(
        id__in=seen_ints, last_seen__time__lt=(timezone.now() - timedelta(hours=12))
    ).update(last_seen=timezone.now())


class LastSeenUpdaterCollector(ProcessingStrategy[Set[int]]):  # type: ignore
    def __init__(self) -> None:
        self.__seen_ints = set()

    def submit(self, message: Message[Set[int]]) -> None:
        self.__seen_ints.update(message.payload)

    def poll(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def close(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        logger.info(f"{len(self.__seen_ints)} unique keys seen")
        _update_stale_last_seen(self.__seen_ints)
        self.__seen_ints = set()


def retrieve_db_read_keys(message: Message[KafkaPayload]) -> Set[int]:
    parsed_message = json.loads(message.payload.value)
    if MAPPING_META in parsed_message:
        if FetchType.DB_READ.value in parsed_message[MAPPING_META]:
            return set(parsed_message[MAPPING_META][FetchType.DB_READ.value].keys())
    return set()


def get_last_seen_updater(
    topic: str,
    group_id: str,
    max_batch_size: int,
    max_batch_time: float,
    auto_offset_reset: str,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:
    processing_factory = KafkaConsumerStrategyFactory(
        max_batch_time=max_batch_time,
        max_batch_size=max_batch_size,
        processes=None,
        input_block_size=None,
        output_block_size=None,
        process_message=retrieve_db_read_keys,
        prefilter=LastSeenUpdaterMessageFilter(),
        collector=lambda: LastSeenUpdaterCollector(),
    )
    return StreamProcessor(
        KafkaConsumer(get_config(topic, group_id, auto_offset_reset)),
        Topic(topic),
        processing_factory,
    )
