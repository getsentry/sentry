from __future__ import annotations

import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import TypeGuard

import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies import MessageRejected
from arroyo.processing.strategies.abstract import ProcessingStrategy, ProcessingStrategyFactory
from arroyo.processing.strategies.commit import CommitOffsets
from arroyo.processing.strategies.run_task import RunTask
from arroyo.types import BrokerValue, Commit, FilteredPayload, Message, Partition
from cachetools.func import ttl_cache
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence
from sentry_sdk.tracing import Span, Transaction

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.monitors.logic.incident_occurrence import send_incident_occurrence
from sentry.monitors.models import CheckInStatus, MonitorCheckIn, MonitorIncident
from sentry.monitors.system_incidents import TickAnomalyDecision, get_clock_tick_decision
from sentry.utils import metrics

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


def _process_incident_occurrence(
    message: Message[KafkaPayload | FilteredPayload], txn: Transaction | Span
):
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
        txn.set_tag("result", "delayed")

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

    # Unlikely, but if we can't find all the check-ins we can't produce an occurrence
    if failed_checkin is None or not has_all(previous_checkins):
        logger.error("missing_check_ins")
        return

    received = datetime.fromtimestamp(wrapper["received_ts"], UTC)

    if use_decision and tick_decision and tick_decision.is_incident():
        # Update the failed check-in as unknown and drop the occurrence.
        #
        # Only consider synthetic check-ins (timeout and miss) since failed
        # check-ins must have been correctly ingested and cannot have been
        # produced during a system incident.
        #
        # XXX(epurkhiser): There is an edge case here where we'll want to
        # determine if the check-in is within the system incident timeframe,
        # since we dispatch occurrences for all check-ins that met a failure
        # threshold. Imagine a monitor that checks-in once a day with a failure
        # threshold of 5. If the last check-in happens to be a miss that is
        # detected during a system-incident, then all 5 previous check-ins
        # would also be marked as unknown, which is incorrect.
        MonitorCheckIn.objects.filter(
            id=failed_checkin.id,
            status__in=CheckInStatus.SYNTHETIC_TERMINAL_VALUES,
        ).update(status=CheckInStatus.UNKNOWN)

        # Do NOT send the occurrence
        txn.set_tag("result", "dropped")
        metrics.incr("monitors.incident_ocurrences.dropped_incident_occurrence")
        return

    try:
        send_incident_occurrence(failed_checkin, previous_checkins, incident, received)
        txn.set_tag("result", "sent")
        metrics.incr("monitors.incident_ocurrences.sent_incident_occurrence")
    except Exception:
        logger.exception("failed_send_incident_occurrence")


def process_incident_occurrence(message: Message[KafkaPayload | FilteredPayload]):
    with sentry_sdk.start_transaction(
        op="_process_incident_occurrence",
        name="monitors.incident_occurrence_consumer",
    ) as txn:
        _process_incident_occurrence(message, txn)


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
