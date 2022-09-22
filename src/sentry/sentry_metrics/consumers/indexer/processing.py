import logging
from typing import Callable, Mapping

from arroyo.types import Message

from sentry import options
from sentry.sentry_metrics.configuration import IndexerStorage, MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.consumers.indexer.common import MessageBatch
from sentry.sentry_metrics.indexer.base import StringIndexer
from sentry.sentry_metrics.indexer.cloudspanner.cloudspanner import CloudSpannerIndexer
from sentry.sentry_metrics.indexer.limiters.cardinality import cardinality_limiter_factory
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.indexer.postgres.postgres_v2 import PostgresIndexer
from sentry.utils import metrics

logger = logging.getLogger(__name__)

STORAGE_TO_INDEXER: Mapping[IndexerStorage, Callable[[], StringIndexer]] = {
    IndexerStorage.CLOUDSPANNER: CloudSpannerIndexer,
    IndexerStorage.POSTGRES: PostgresIndexer,
    IndexerStorage.MOCK: MockIndexer,
}


class MessageProcessor:
    def __init__(self, config: MetricsIngestConfiguration):
        self._indexer = STORAGE_TO_INDEXER[config.db_backend](**config.db_backend_options)
        self._config = config

    # The following two methods are required to work such that the parallel
    # indexer can spawn subprocesses correctly.
    #
    # We get/set just the config (assuming it's pickleable) and re-instantiate
    # the indexer backend in the subprocess (assuming that it usually isn't)

    def __getstate__(self) -> MetricsIngestConfiguration:
        return self._config

    def __setstate__(self, config: MetricsIngestConfiguration) -> None:
        # mypy: "cannot access init directly"
        # yes I can, watch me.
        self.__init__(config)  # type: ignore

    def process_messages(
        self,
        outer_message: Message[MessageBatch],
    ) -> MessageBatch:
        """
        We have an outer_message Message() whose payload is a batch of Message() objects.

            Message(
                partition=...,
                offset=...
                timestamp=...
                payload=[Message(...), Message(...), etc]
            )

        The inner messages payloads are KafkaPayload's that have:
            * key
            * headers
            * value

        The value of the message is what we need to parse and then translate
        using the indexer.
        """
        should_index_tag_values = (
            options.get(self._config.index_tag_values_option_name)
            if self._config.index_tag_values_option_name
            else True
        )

        batch = IndexerBatch(self._config.use_case_id, outer_message, should_index_tag_values)

        with metrics.timer("metrics_consumer.check_cardinality_limits"):
            cardinality_limiter = cardinality_limiter_factory.get_ratelimiter(self._config)
            cardinality_limiter_state = cardinality_limiter.check_cardinality_limits(
                batch.use_case_id, batch.parsed_payloads_by_offset
            )

        batch.filter_messages(cardinality_limiter_state.keys_to_remove)

        org_strings = batch.extract_strings()

        with metrics.timer("metrics_consumer.bulk_record"):
            record_result = self._indexer.bulk_record(
                use_case_id=self._config.use_case_id, org_strings=org_strings
            )

        mapping = record_result.get_mapped_results()
        bulk_record_meta = record_result.get_fetch_metadata()

        new_messages = batch.reconstruct_messages(mapping, bulk_record_meta)

        with metrics.timer("metrics_consumer.apply_cardinality_limits"):
            # TODO: move to separate thread
            cardinality_limiter.apply_cardinality_limits(cardinality_limiter_state)

        return new_messages
