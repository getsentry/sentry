from __future__ import annotations

from atexit import register
from collections import deque
from concurrent import futures
from concurrent.futures import Future
from typing import Deque

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
        producer_config.pop("compression.type")
        producer_config.pop("message.max.bytes")
        occurrence_producer = KafkaProducer(
            build_kafka_configuration(default_config=producer_config)
        )
    return occurrence_producer


def produce_occurrence_to_kafka(occurrence: IssueOccurrence) -> None:
    print("Producing to Kafka")
    payload = KafkaPayload(None, json.dumps(occurrence.to_dict()).encode("utf-8"), [])
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
            future.result()
        except IndexError:
            return


def handle_occurrence_producer() -> None:
    futures.wait(occurrence_producer_futures)
    get_occurrence_producer().close()


register(handle_occurrence_producer)
