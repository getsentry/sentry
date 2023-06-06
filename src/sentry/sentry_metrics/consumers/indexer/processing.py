import logging
import random
from typing import Any, Callable, Mapping

import sentry_kafka_schemas
import sentry_sdk
from arroyo.types import Message
from django.conf import settings

from sentry import options
from sentry.sentry_metrics.configuration import IndexerStorage, MetricsIngestConfiguration
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.consumers.indexer.common import IndexerOutputMessageBatch, MessageBatch
from sentry.sentry_metrics.indexer.base import StringIndexer
from sentry.sentry_metrics.indexer.limiters.cardinality import cardinality_limiter_factory
from sentry.sentry_metrics.indexer.mock import MockIndexer
from sentry.sentry_metrics.indexer.postgres.postgres_v2 import PostgresIndexer
from sentry.utils import metrics, sdk

logger = logging.getLogger(__name__)

STORAGE_TO_INDEXER: Mapping[IndexerStorage, Callable[[], StringIndexer]] = {
    IndexerStorage.POSTGRES: PostgresIndexer,
    IndexerStorage.MOCK: MockIndexer,
}

_INGEST_CODEC: sentry_kafka_schemas.codecs.Codec[Any] = sentry_kafka_schemas.get_codec(
    "ingest-metrics"
)


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

    def process_messages(self, outer_message: Message[MessageBatch]) -> IndexerOutputMessageBatch:
        with sentry_sdk.start_transaction(
            name="sentry.sentry_metrics.consumers.indexer.processing.process_messages",
            sampled=random.random() < settings.SENTRY_METRICS_INDEXER_TRANSACTIONS_SAMPLE_RATE,
        ):
            return self._process_messages_impl(outer_message)

    def _process_messages_impl(
        self,
        outer_message: Message[MessageBatch],
    ) -> IndexerOutputMessageBatch:
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
        is_output_sliced = self._config.is_output_sliced or False

        batch = IndexerBatch(
            outer_message,
            should_index_tag_values=should_index_tag_values,
            is_output_sliced=is_output_sliced,
            input_codec=_INGEST_CODEC,
        )

        sdk.set_measurement("indexer_batch.payloads.len", len(batch.parsed_payloads_by_offset))

        with metrics.timer("metrics_consumer.check_cardinality_limits"), sentry_sdk.start_span(
            op="check_cardinality_limits"
        ):
            cardinality_limiter = cardinality_limiter_factory.get_ratelimiter(self._config)
            cardinality_limiter_state = cardinality_limiter.check_cardinality_limits(
                self._config.use_case_id, batch.parsed_payloads_by_offset
            )

        sdk.set_measurement(
            "cardinality_limiter.keys_to_remove.len", len(cardinality_limiter_state.keys_to_remove)
        )
        batch.filter_messages(cardinality_limiter_state.keys_to_remove)

        extracted_strings = batch.extract_strings()

        sdk.set_measurement("org_strings.len", len(extracted_strings))

        with metrics.timer("metrics_consumer.bulk_record"), sentry_sdk.start_span(op="bulk_record"):
            record_result = self._indexer.bulk_record(extracted_strings)

        mapping = record_result.get_mapped_results()
        bulk_record_meta = record_result.get_fetch_metadata()

        new_messages = batch.reconstruct_messages(mapping, bulk_record_meta)

        sdk.set_measurement("new_messages.len", len(new_messages))

        with metrics.timer("metrics_consumer.apply_cardinality_limits"), sentry_sdk.start_span(
            op="apply_cardinality_limits"
        ):
            # TODO: move to separate thread
            cardinality_limiter.apply_cardinality_limits(cardinality_limiter_state)

        return new_messages
