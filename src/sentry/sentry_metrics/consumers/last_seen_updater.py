import datetime
import functools
import random
from datetime import timedelta
from typing import Any, Mapping, Optional, Set, Union

import rapidjson
from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies.streaming import KafkaConsumerStrategyFactory
from arroyo.processing.strategies.streaming.factory import StreamMessageFilter
from django.utils import timezone

from sentry import options
from sentry.sentry_metrics.consumers.indexer.common import get_config
from sentry.sentry_metrics.consumers.indexer.multiprocess import logger
from sentry.sentry_metrics.indexer.base import FetchType
from sentry.sentry_metrics.indexer.models import StringIndexer
from sentry.utils import json

MAPPING_META = "mapping_meta"


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


class LastSeenUpdaterMessageFilter(StreamMessageFilter[Message[KafkaPayload]]):  # type: ignore
    def __init__(self, metrics: Any) -> None:
        self.__metrics = metrics

    # We want to ignore messages where the mapping_sources header is present
    # and does not contain the DB_READ ('d') character (this should be the vast
    # majority of messages).
    def should_drop(self, message: Message[KafkaPayload]) -> bool:
        feature_enabled: float = options.get("sentry-metrics.last-seen-updater.accept-rate")
        bypass_for_user = random.random() > feature_enabled
        sample_rate = 0.001
        if random.random() < sample_rate:
            self.__metrics.incr(
                "last_seen_updater.accept_rate",
                tags={"bypass": bypass_for_user},
                amount=1.0 / sample_rate,
            )

        if bypass_for_user:
            return True

        header_value: Optional[str] = next(
            (
                str(header[1])
                for header in message.payload.headers
                if header[0] == "mapping_sources"
            ),
            None,
        )

        if not header_value:
            self.__metrics.incr("last_seen_updater.header_not_present")
            return False

        return FetchType.DB_READ.value not in str(header_value)


def _update_stale_last_seen(
    seen_ints: Set[int], new_last_seen_time: Optional[datetime.datetime] = None
) -> int:
    if new_last_seen_time is None:
        new_last_seen_time = timezone.now()

    # TODO: filter out ints that we've handled recently in memcache to reduce DB load
    # we may not need a cache, we should see as we dial up the accept rate
    return int(
        StringIndexer.objects.filter(
            id__in=seen_ints, last_seen__lt=(timezone.now() - timedelta(hours=12))
        ).update(last_seen=new_last_seen_time)
    )


class LastSeenUpdaterCollector(ProcessingStrategy[Set[int]]):  # type: ignore
    def __init__(self, metrics: Any) -> None:
        self.__seen_ints: Set[int] = set()
        self.__metrics = metrics

    def submit(self, message: Message[Set[int]]) -> None:
        self.__seen_ints.update(message.payload)

    def poll(self) -> None:
        pass

    def terminate(self) -> None:
        pass

    def close(self) -> None:
        pass

    def join(self, timeout: Optional[float] = None) -> None:
        keys_to_pass_to_update = len(self.__seen_ints)
        logger.debug(f"{keys_to_pass_to_update} unique keys seen")
        self.__metrics.incr(
            "last_seen_updater.unique_update_candidate_keys", amount=keys_to_pass_to_update
        )
        with self.__metrics.timer("last_seen_updater.postgres_time"):
            update_count = _update_stale_last_seen(self.__seen_ints)
        self.__metrics.incr("last_seen_updater.updated_rows_count", amount=update_count)
        logger.debug(f"{update_count} keys updated")
        self.__seen_ints = set()


def retrieve_db_read_keys(message: Message[KafkaPayload]) -> Set[int]:
    try:
        parsed_message = json.loads(message.payload.value, use_rapid_json=True)
        if MAPPING_META in parsed_message:
            if FetchType.DB_READ.value in parsed_message[MAPPING_META]:
                return {
                    int(key) for key in parsed_message[MAPPING_META][FetchType.DB_READ.value].keys()
                }
        return set()
    except rapidjson.JSONDecodeError:
        logger.error("last_seen_updater.invalid_json", exc_info=True)
        return set()


def _last_seen_updater_processing_factory(
    max_batch_size: int, max_batch_time: float
) -> KafkaConsumerStrategyFactory:
    return KafkaConsumerStrategyFactory(
        max_batch_time=max_batch_time,
        max_batch_size=max_batch_size,
        processes=None,
        input_block_size=None,
        output_block_size=None,
        process_message=retrieve_db_read_keys,
        prefilter=LastSeenUpdaterMessageFilter(metrics=get_metrics()),
        collector=lambda: LastSeenUpdaterCollector(metrics=get_metrics()),
    )


def get_last_seen_updater(
    topic: str,
    group_id: str,
    max_batch_size: int,
    max_batch_time: float,
    auto_offset_reset: str,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor:
    processing_factory = _last_seen_updater_processing_factory(max_batch_size, max_batch_time)
    return StreamProcessor(
        KafkaConsumer(get_config(topic, group_id, auto_offset_reset)),
        Topic(topic),
        processing_factory,
    )
