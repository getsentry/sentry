from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry.monitors.consumers.incident_occurrences_consumer import (
    MONITORS_INCIDENT_OCCURRENCES,
    MonitorIncidentOccurenceStrategyFactory,
)

partition = Partition(Topic("test"), 0)


def create_consumer() -> ProcessingStrategy[KafkaPayload]:
    factory = MonitorIncidentOccurenceStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


def sned_incident_occurrence(
    consumer: ProcessingStrategy[KafkaPayload],
    ts: datetime,
    incident_occurrence: IncidentOccurrence,
):
    value = BrokerValue(
        KafkaPayload(b"fake-key", MONITORS_INCIDENT_OCCURRENCES.encode(incident_occurrence), []),
        partition,
        1,
        ts,
    )
    consumer.submit(Message(value))


def test_simple():
    # XXX(epurkhiser): Doesn't really test anything yet
    ts = timezone.now().replace(second=0, microsecond=0)

    consumer = create_consumer()
    sned_incident_occurrence(
        consumer,
        ts,
        {
            "clock_tick_ts": 1617895645,
            "received_ts": 1617895650,
            "failed_checkin_id": 123456,
            "incident_id": 987654,
            "previous_checkin_ids": [111222, 333444, 55666],
        },
    )
