import functools
import logging
from typing import TYPE_CHECKING

from arroyo.types import Message

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.consumers.indexer.batch import IndexerBatch
from sentry.sentry_metrics.consumers.indexer.common import MessageBatch

logger = logging.getLogger(__name__)


@functools.lru_cache(maxsize=10)
def get_metrics():  # type: ignore
    from sentry.utils import metrics

    return metrics


@functools.lru_cache(maxsize=10)
def get_indexer():  # type: ignore
    from sentry.sentry_metrics import indexer

    return indexer


def process_messages(
    use_case_id: UseCaseKey,
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
    if TYPE_CHECKING:
        from sentry.sentry_metrics import indexer
        from sentry.utils import metrics
    else:
        # This, instead of importing the normal way, was likely done to prevent
        # fork-safety issues.
        indexer = get_indexer()
        metrics = get_metrics()

    batch = IndexerBatch(use_case_id, outer_message)

    org_strings = batch.extract_strings()

    with metrics.timer("metrics_consumer.bulk_record"):
        record_result = indexer.bulk_record(use_case_id=use_case_id, org_strings=org_strings)

    mapping = record_result.get_mapped_results()
    bulk_record_meta = record_result.get_fetch_metadata()

    new_messages = batch.reconstruct_messages(mapping, bulk_record_meta)
    return new_messages
