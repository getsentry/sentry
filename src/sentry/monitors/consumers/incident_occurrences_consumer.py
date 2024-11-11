from __future__ import annotations

import logging
from collections.abc import Mapping

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry.conf.types.kafka_definition import Topic, get_topic_codec

logger = logging.getLogger(__name__)

MONITORS_INCIDENT_OCCURRENCES: Codec[IncidentOccurrence] = get_topic_codec(
    Topic.MONITORS_INCIDENT_OCCURRENCES
)


def process_incident_occurrence(message: Message[KafkaPayload | FilteredPayload]):
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    # wrapper: IncidentOccurrence = MONITORS_INCIDENT_OCCURRENCES.decode(message.payload.value)
    # TODO(epurkhiser): Do something with issue occurrence


class MonitorIncidentOccurenceStrategyFactory(ProcessingStrategyFactory[KafkaPayload]):
    def __init__(self) -> None:
        pass

    def create_with_partitions(
        self,
        commit: Commit,
        partitions: Mapping[Partition, int],
    ) -> ProcessingStrategy[KafkaPayload]:
        return RunTask(
            function=process_incident_occurrence,
            next_step=CommitOffsets(commit),
        )
