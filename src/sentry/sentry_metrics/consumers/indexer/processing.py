import logging

from arroyo.types import Message

from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.consumers.indexer.common import MessageBatch
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class MessageProcessor:
    # todo: update message processor to take config instead of just use case
    # and use the config to initialize indexer vs using service model
    def __init__(self, use_case_id: UseCaseKey):
        self._use_case_id = use_case_id
        self._indexer = indexer

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
        batch = IndexerBatch(self._use_case_id, outer_message)

        org_strings = batch.extract_strings()

        with metrics.timer("metrics_consumer.bulk_record"):
            record_result = self._indexer.bulk_record(
                use_case_id=self._use_case_id, org_strings=org_strings
            )

        mapping = record_result.get_mapped_results()
        bulk_record_meta = record_result.get_fetch_metadata()

        new_messages = batch.reconstruct_messages(mapping, bulk_record_meta)
        return new_messages
