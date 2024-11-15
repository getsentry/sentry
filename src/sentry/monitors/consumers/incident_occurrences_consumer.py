from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TypeGuard

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.logic.incident_occurrence import create_incident_occurrence
from sentry.monitors.models import MonitorCheckIn, MonitorIncident

logger = logging.getLogger(__name__)

MONITORS_INCIDENT_OCCURRENCES: Codec[IncidentOccurrence] = get_topic_codec(
    Topic.MONITORS_INCIDENT_OCCURRENCES
)


def process_incident_occurrence(message: Message[KafkaPayload | FilteredPayload]):
    """
    Process a incident occurrence message. This will immediately dispatch an
    issue occurrence via create_incident_occurrence.
    """
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    wrapper: IncidentOccurrence = MONITORS_INCIDENT_OCCURRENCES.decode(message.payload.value)

    try:
        incident = MonitorIncident.objects.get(id=int(wrapper["incident_id"]))
    except MonitorIncident.DoesNotExist:
        logger.exception("missing_incident")
        return

    # previous_checkin_ids includes the failed_checkin_id
    checkins = MonitorCheckIn.objects.filter(id__in=wrapper["previous_checkin_ids"])
    checkins_map: dict[int, MonitorCheckIn] = {checkin.id: checkin for checkin in checkins}

    failed_checkin = checkins_map.get(int(wrapper["failed_checkin_id"]))
    previous_checkins = [checkins_map.get(int(id)) for id in wrapper["previous_checkin_ids"]]

    def has_all(checkins: list[MonitorCheckIn | None]) -> TypeGuard[list[MonitorCheckIn]]:
        return None not in checkins

    # Unlikely, but if we can't find all the check-ins we can't produce an occurence
    if failed_checkin is None or not has_all(previous_checkins):
        logger.error("missing_check_ins")
        return

    received = datetime.fromtimestamp(wrapper["received_ts"], UTC)

    create_incident_occurrence(failed_checkin, previous_checkins, incident, received)


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
