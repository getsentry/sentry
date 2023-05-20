from __future__ import annotations

from atexit import register
from collections import deque
from concurrent import futures
from concurrent.futures import Future
from typing import Any, Deque, Dict, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from arroyo.types import BrokerValue
from django.conf import settings

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.utils import json
from sentry.utils.kafka_config import get_kafka_producer_cluster_options

occurrence_producer = None


def get_occurrence_producer() -> KafkaProducer:
    global occurrence_producer
    if occurrence_producer is None:
        cluster_name = settings.KAFKA_TOPICS[settings.KAFKA_INGEST_OCCURRENCES]["cluster"]
        producer_config = get_kafka_producer_cluster_options(cluster_name)
        producer_config.pop("compression.type", None)
        producer_config.pop("message.max.bytes", None)
        occurrence_producer = KafkaProducer(
            build_kafka_configuration(default_config=producer_config)
        )
    return occurrence_producer


def produce_occurrence_to_kafka(
    occurrence: IssueOccurrence, event_data: Optional[Dict[str, Any]] = None
) -> None:
    if event_data and occurrence.event_id != event_data["event_id"]:
        raise ValueError("Event id on occurrence and event_data must be the same")
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev. Skip producing to Kafka and just
        # write to the issue platform directly
        from sentry.issues.occurrence_consumer import (
            lookup_event_and_process_issue_occurrence,
            process_event_and_issue_occurrence,
        )

        if event_data:
            process_event_and_issue_occurrence(occurrence.to_dict(), event_data)
        else:
            lookup_event_and_process_issue_occurrence(occurrence.to_dict())
        return
    payload_data = occurrence.to_dict()
    if event_data:
        payload_data["event"] = event_data
    payload = KafkaPayload(None, json.dumps(payload_data).encode("utf-8"), [])
    occurrence_producer = get_occurrence_producer()
    future = occurrence_producer.produce(Topic(settings.KAFKA_INGEST_OCCURRENCES), payload)

    track_occurrence_producer_futures(future)


occurrence_producer_futures: Deque[Future[BrokerValue[KafkaPayload]]] = deque()


def track_occurrence_producer_futures(future: Future[BrokerValue[KafkaPayload]]) -> None:
    global occurrence_producer_futures
    occurrence_producer_futures.append(future)
    if len(occurrence_producer_futures) >= settings.SENTRY_ISSUE_PLATFORM_FUTURES_MAX_LIMIT:
        try:
            future = occurrence_producer_futures.popleft()
        except IndexError:
            return
        else:
            future.result()


def handle_occurrence_producer() -> None:
    futures.wait(occurrence_producer_futures)
    if occurrence_producer:
        occurrence_producer.close()


register(handle_occurrence_producer)
