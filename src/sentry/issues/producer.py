from __future__ import annotations

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options


def _get_occurrence_producer() -> KafkaProducer:
    cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_OCCURRENCES]["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_occurrence_producer = SingletonProducer(
    _get_occurrence_producer, max_futures=settings.SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT
)


def produce_occurrence_to_kafka(occurrence: IssueOccurrence) -> None:
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev. Skip producing to Kafka and just
        # write to the issue platform directly
        from sentry.issues.occurrence_consumer import lookup_event_and_process_issue_occurrence

        lookup_event_and_process_issue_occurrence(occurrence.to_dict())
        return
    payload = KafkaPayload(None, json.dumps(occurrence.to_dict()).encode("utf-8"), [])
    _occurrence_producer.produce(Topic(settings.KAFKA_INGEST_OCCURRENCES), payload)
