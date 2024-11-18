from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TypeGuard

from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from cachetools.func import ttl_cache
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.logic.incident_occurrence import send_incident_occurrence
from sentry.monitors.models import MonitorCheckIn, MonitorIncident
from sentry.monitors.system_incidents import TickAnomalyDecision, get_clock_tick_decision

logger = logging.getLogger(__name__)

MONITORS_INCIDENT_OCCURRENCES: Codec[IncidentOccurrence] = get_topic_codec(
    Topic.MONITORS_INCIDENT_OCCURRENCES
)


@ttl_cache(ttl=5)
def memoized_tick_decision(tick: datetime) -> TickAnomalyDecision | None:
    """
    Memoized version of get_clock_tick_decision. Used in
    process_incident_occurrence to avoid stampeding calls when waiting for a
    tick decision to resolve.
    """
    return get_clock_tick_decision(tick)


def process_incident_occurrence(message: Message[KafkaPayload | FilteredPayload]):
    """
    Process a incident occurrence message. This will immediately dispatch an
    issue occurrence via send_incident_occurrence.
    """
    assert not isinstance(message.payload, FilteredPayload)
    assert isinstance(message.value, BrokerValue)

    wrapper: IncidentOccurrence = MONITORS_INCIDENT_OCCURRENCES.decode(message.payload.value)
    clock_tick = datetime.fromtimestamp(wrapper["clock_tick_ts"], UTC)

    # May be used as a killswitch if system incident decisions become incorrect
    # for any reason
    use_decision = options.get("crons.system_incidents.use_decisions")
    tick_decision = memoized_tick_decision(clock_tick)

    if use_decision and tick_decision and tick_decision.is_pending():
        # The decision is pending resolution. We need to stop consuming until
        # the tick decision is resolved so we can know if it's OK to dispatch the
        # incident occurrence, or if we should drop the occurrence and mark the
        # associated check-ins as UNKNOWN due to a system incident.

        # XXX(epurkhiser): MessageRejected tells arroyo that we can't process
        # this message right now and it should try again
        raise MessageRejected()

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

    if use_decision and tick_decision and tick_decision.is_incident():
        # TODO(epurkhiser): We are in a system incident. Mark the check-in
        # which triggerd this incident occurrence as unknown
        #
        # We may need some additional logic do determine if one of the
        # previous_checkins was part of the incident to decide if we can mark that
        # as unknown.
        pass

    try:
        send_incident_occurrence(failed_checkin, previous_checkins, incident, received)
    except Exception:
        logger.exception("failed_send_incident_occurrence")


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
