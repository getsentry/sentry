import datetime
import functools
from abc import abstractmethod
from datetime import timedelta
from typing import Any, Callable, Mapping, Optional, Set

import rapidjson
from arroyo.backends.kafka import KafkaConsumer, KafkaPayload
from arroyo.commit import IMMEDIATE, ONCE_PER_SECOND
from arroyo.processing import StreamProcessor
from arroyo.processing.strategies import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.filter import FilterStep
from arroyo.processing.strategies.reduce import Reduce
from arroyo.processing.strategies.run_task import RunTask
from arroyo.processing.strategies.transform import TransformStep
from arroyo.types import BaseValue, Commit, Message, Partition, Topic
from django.utils import timezone

from sentry.sentry_metrics.configuration import MetricsIngestConfiguration, UseCaseKey
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


class StreamMessageFilter:
    """
    A filter over messages coming from a stream. Can be used to pre filter
    messages during consumption but potentially for other use cases as well.
    """

    @abstractmethod
    def should_drop(self, message: Message[KafkaPayload]) -> bool:
        raise NotImplementedError


class LastSeenUpdaterMessageFilter(StreamMessageFilter):
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


class LastSeenUpdaterStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(
        self,
        use_case_id: UseCaseKey,
        max_batch_size: int,
        max_batch_time: float,
    ) -> None:
        self.__use_case_id = use_case_id
        self.__max_batch_size = max_batch_size
        self.__max_batch_time = max_batch_time
        self.__metrics = get_metrics()
        self.__prefilter = LastSeenUpdaterMessageFilter(metrics=self.__metrics)

    def __should_accept(self, message: Message[KafkaPayload]) -> bool:
        return not self.__prefilter.should_drop(message)

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        def accumulator(result: Set[int], value: BaseValue[Set[int]]) -> Set[int]:
            result.update(value.payload)
            return result

        initial_value: Callable[[], Set[int]] = lambda: set()

        def do_update(message: Message[Set[int]]) -> None:
            table = TABLE_MAPPING[self.__use_case_id]
            seen_ints = message.payload

            keys_to_pass_to_update = len(seen_ints)
            logger.debug(f"{keys_to_pass_to_update} unique keys seen")
            self.__metrics.incr(
                "last_seen_updater.unique_update_candidate_keys", amount=keys_to_pass_to_update
            )
            with self.__metrics.timer("last_seen_updater.postgres_time"):
                update_count = _update_stale_last_seen(table, seen_ints)
            self.__metrics.incr("last_seen_updater.updated_rows_count", amount=update_count)
            logger.debug(f"{update_count} keys updated")

        collect_step: Reduce[Set[int], Set[int]] = Reduce(
            self.__max_batch_size,
            self.__max_batch_time,
            accumulator,
            initial_value,
            RunTask(do_update, CommitOffsets(commit)),
        )

        transform_step = TransformStep(retrieve_db_read_keys, collect_step)
        return FilterStep(self.__should_accept, transform_step, commit_policy=ONCE_PER_SECOND)


def get_last_seen_updater(
    group_id: str,
    max_batch_size: int,
    max_batch_time: float,
    auto_offset_reset: str,
    strict_offset_reset: bool,
    ingest_config: MetricsIngestConfiguration,
) -> StreamProcessor[KafkaPayload]:
    """
    The last_seen updater uses output from the metrics indexer to update the
    last_seen field in the sentry_stringindexer and sentry_perfstringindexer database
    tables. This enables us to do deletions of tag keys/values that haven't been
    accessed over the past N days (generally, 90).
    """
    processing_factory = LastSeenUpdaterStrategyFactory(
        ingest_config.use_case_id,
        max_batch_size=max_batch_size,
        max_batch_time=max_batch_time,
    )

    return StreamProcessor(
        KafkaConsumer(
            get_config(
                ingest_config.output_topic,
                group_id,
                auto_offset_reset=auto_offset_reset,
                strict_offset_reset=strict_offset_reset,
            )
        ),
        Topic(ingest_config.output_topic),
        processing_factory,
        IMMEDIATE,
    )
