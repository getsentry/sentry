import datetime
import functools
from datetime import timedelta
from typing import Any, Mapping, Optional, Set, Union

import rapidjson
from arroyo import Message, Topic
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.processing.strategies.factory import KafkaConsumerStrategyFactory, StreamMessageFilter
from arroyo.types import TPayload
from django.utils import timezone

from sentry.sentry_metrics.configuration import MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.common import get_config
from sentry.sentry_metrics.consumers.indexer.multiprocess import logger
from sentry.sentry_metrics.indexer.base import FetchType
from sentry.sentry_metrics.indexer.postgres.models import TABLE_MAPPING, IndexerTable
from sentry.utils import json

MAPPING_META = "mapping_meta"


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


class LastSeenUpdaterMessageFilter(StreamMessageFilter[KafkaPayload]):
    def __init__(self, metrics: Any) -> None:
        self.__metrics = metrics

    # We want to ignore messages where the mapping_sources header is present
    # and does not contain the DB_READ ('d') character (this should be the vast
    # majority of messages).
    def should_drop(self, message: Message[KafkaPayload]) -> bool:
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


class KeepAliveMessageFilter(StreamMessageFilter[TPayload]):
    """
    A message filter that wraps another message filter, and ensures that at
    most `consecutive_drop_limit` messages are dropped in a row. If the wrapped
    `inner_filter` drops `consecutive_drop_limit` messages in a row, the next
    message will be unconditionally accepted.

    The reason to use this has to do with the way Kafka works. Kafka works with
    offsets of messages which need to be committed to the broker to acknowledge
    them. In cases where there is a shared topic, and only one type of messages
    on the topic, if we drop all messages then that consumer would never commit
    offsets to the broker which would result in increase in consumer group lag
    of the consumer group.

    This leads to false positives in our alerts regarding consumer group having
    some issues.

    Note: This filter can only be used if the wrapped filter is not required
    for correctness.
    """

    def __init__(
        self, inner_filter: StreamMessageFilter[TPayload], consecutive_drop_limit: int
    ) -> None:
        self.inner_filter = inner_filter
        self.consecutive_drop_count = 0
        self.consecutive_drop_limit = consecutive_drop_limit

    def should_drop(self, message: Message[TPayload]) -> bool:
        if not self.inner_filter.should_drop(message):
            self.consecutive_drop_count = 0
            return False

        self.consecutive_drop_count += 1
        if self.consecutive_drop_count < self.consecutive_drop_limit:
            return True
        else:
            self.consecutive_drop_count = 0
            return False


def _update_stale_last_seen(
    table: IndexerTable, seen_ints: Set[int], new_last_seen_time: Optional[datetime.datetime] = None
) -> int:
    if new_last_seen_time is None:
        new_last_seen_time = timezone.now()

    # TODO: filter out ints that we've handled recently in memcache to reduce DB load
    # we may not need a cache, we should see as we dial up the accept rate
    return int(
        table.objects.filter(
            id__in=seen_ints, last_seen__lt=(timezone.now() - timedelta(hours=12))
        ).update(last_seen=new_last_seen_time)
    )


class LastSeenUpdaterCollector(ProcessingStrategy[Set[int]]):
    def __init__(self, metrics: Any, table: IndexerTable) -> None:
        self.__seen_ints: Set[int] = set()
        self.__metrics = metrics
        self.__table = table

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
            update_count = _update_stale_last_seen(self.__table, self.__seen_ints)
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
    max_batch_size: int, max_batch_time: float, ingest_config: MetricsIngestConfiguration
) -> KafkaConsumerStrategyFactory:
    return KafkaConsumerStrategyFactory(
        max_batch_time=max_batch_time,
        max_batch_size=max_batch_size,
        processes=None,
        input_block_size=None,
        output_block_size=None,
        process_message=retrieve_db_read_keys,
        prefilter=KeepAliveMessageFilter(LastSeenUpdaterMessageFilter(metrics=get_metrics()), 100),
        collector=lambda: LastSeenUpdaterCollector(
            metrics=get_metrics(), table=TABLE_MAPPING[ingest_config.use_case_id]
        ),
    )


def get_last_seen_updater(
    group_id: str,
    max_batch_size: int,
    max_batch_time: float,
    auto_offset_reset: str,
    ingest_config: MetricsIngestConfiguration,
    **options: Mapping[str, Union[str, int]],
) -> StreamProcessor[KafkaPayload]:
    """
    The last_seen updater uses output from the metrics indexer to update the
    last_seen field in the sentry_stringindexer and sentry_perfstringindexer database
    tables. This enables us to do deletions of tag keys/values that haven't been
    accessed over the past N days (generally, 90).
    """
    processing_factory = _last_seen_updater_processing_factory(
        max_batch_size, max_batch_time, ingest_config
    )
    return StreamProcessor(
        KafkaConsumer(get_config(ingest_config.output_topic, group_id, auto_offset_reset)),
        Topic(ingest_config.output_topic),
        processing_factory,
    )
