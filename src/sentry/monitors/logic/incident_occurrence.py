from __future__ import annotations

import logging
import uuid
from collections import Counter
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.utils.text import get_text_list
from django.utils.translation import gettext_lazy as _
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry import options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.issues.grouptype import MonitorIncidentType
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
)
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

logger = logging.getLogger(__name__)

MONITORS_INCIDENT_OCCURRENCES: Codec[IncidentOccurrence] = get_topic_codec(
    Topic.MONITORS_INCIDENT_OCCURRENCES
)


def _get_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.MONITORS_INCIDENT_OCCURRENCES)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_incident_occurrence_producer = SingletonProducer(_get_producer)


def dispatch_incident_occurrence(
    failed_checkin: MonitorCheckIn,
    previous_checkins: Sequence[MonitorCheckIn],
    incident: MonitorIncident,
    received: datetime,
    clock_tick: datetime | None,
) -> None:
    """
    Determine how to route a incident occurrence.

    - When failed check-in triggers mark_failed directly from the
      monitor_consumer we will immediately dispatch the associated incident
      occurrence.

      This is indicated by the lack of a `clock_tick`.

    - When a synthetic failed check-in (time-out or miss) triggers mark_failed
      we will queue the incident occurrence to be processed later, allowing for
      the occurrence to be delayed or dropped in the case a systems incident.

      This is indicated by the presence of a `clock_tick`.
    """
    # XXX(epurkhiser): Dispatching via the consumer is behind a flag while we
    # verify things are working well.
    consumer_dispatch_enabled = options.get("crons.dispatch_incident_occurrences_to_consumer")

    if clock_tick and consumer_dispatch_enabled:
        queue_incident_occurrence(failed_checkin, previous_checkins, incident, received, clock_tick)
    else:
        send_incident_occurrence(failed_checkin, previous_checkins, incident, received)


def queue_incident_occurrence(
    failed_checkin: MonitorCheckIn,
    previous_checkins: Sequence[MonitorCheckIn],
    incident: MonitorIncident,
    received: datetime,
    clock_tick: datetime,
) -> None:
    """
    Queue an issue occurrence for a monitor incident.

    This incident occurrence will be processed by the
    `incident_occurrence_consumer`. Queuing is used here to allow for issue
    occurrences to be delayed in the scenario where Sentry may be experiencing
    a systems incident (eg. Relay cannot process check-ins). In these scenarios
    the consumer will delay consumption until we can determine there is no
    systems incident. Or in the worst case, will drop incident occurrences
    since we can no longer reliably guarantee the occurrences are accurate.
    """
    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return

    incident_occurrence: IncidentOccurrence = {
        "incident_id": incident.id,
        "failed_checkin_id": failed_checkin.id,
        "previous_checkin_ids": [checkin.id for checkin in previous_checkins],
        "received_ts": int(received.timestamp()),
        "clock_tick_ts": int(clock_tick.timestamp()),
    }

    # The incident occurrence is partitioned by monitor environment ID, just
    # the same as the clock tasks. Ensures issue occurences are sent in order.
    payload = KafkaPayload(
        str(monitor_env.id).encode(),
        MONITORS_INCIDENT_OCCURRENCES.encode(incident_occurrence),
        [],
    )

    topic = get_topic_definition(Topic.MONITORS_INCIDENT_OCCURRENCES)["real_topic_name"]
    _incident_occurrence_producer.produce(ArroyoTopic(topic), payload)


def send_incident_occurrence(
    failed_checkin: MonitorCheckIn,
    previous_checkins: Sequence[MonitorCheckIn],
    incident: MonitorIncident,
    received: datetime,
) -> None:
    """
    Construct and send an issue occurrence given an incident and the associated
    failing check-ins which caused that incident.
    """
    monitor_env = failed_checkin.monitor_environment

    if monitor_env is None:
        return

    current_timestamp = datetime.now(timezone.utc)

    # Get last successful check-in to show in evidence display
    last_successful_checkin_timestamp = "Never"
    last_successful_checkin = monitor_env.get_last_successful_checkin()
    if last_successful_checkin:
        last_successful_checkin_timestamp = last_successful_checkin.date_added.isoformat()

    occurrence = IssueOccurrence(
        id=uuid.uuid4().hex,
        resource_id=None,
        project_id=monitor_env.monitor.project_id,
        event_id=uuid.uuid4().hex,
        fingerprint=[incident.grouphash],
        type=MonitorIncidentType,
        issue_title=f"Monitor failure: {monitor_env.monitor.name}",
        subtitle="Your monitor has reached its failure threshold.",
        evidence_display=[
            IssueEvidence(
                name="Failure reason",
                value=str(get_failure_reason(previous_checkins)),
                important=True,
            ),
            IssueEvidence(
                name="Environment",
                value=monitor_env.get_environment().name,
                important=False,
            ),
            IssueEvidence(
                name="Last successful check-in",
                value=last_successful_checkin_timestamp,
                important=False,
            ),
        ],
        evidence_data={},
        culprit="",
        detection_time=current_timestamp,
        level="error",
        assignee=monitor_env.monitor.owner_actor,
    )

    if failed_checkin.trace_id:
        trace_id = failed_checkin.trace_id.hex
    else:
        trace_id = None

    event_data = {
        "contexts": {"monitor": get_monitor_environment_context(monitor_env)},
        "environment": monitor_env.get_environment().name,
        "event_id": occurrence.event_id,
        "fingerprint": [incident.grouphash],
        "platform": "other",
        "project_id": monitor_env.monitor.project_id,
        # This is typically the time that the checkin that triggered the
        # occurrence was written to relay, otherwise it is when we detected a
        # missed or timeout.
        "received": received.isoformat(),
        "sdk": None,
        "tags": {
            "monitor.id": str(monitor_env.monitor.guid),
            "monitor.slug": str(monitor_env.monitor.slug),
            "monitor.incident": str(incident.id),
        },
        "timestamp": current_timestamp.isoformat(),
    }

    if trace_id:
        event_data["contexts"]["trace"] = {"trace_id": trace_id, "span_id": None}

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE,
        occurrence=occurrence,
        event_data=event_data,
    )


HUMAN_FAILURE_STATUS_MAP: Mapping[int, _StrPromise] = {
    CheckInStatus.ERROR: _("error"),
    CheckInStatus.MISSED: _("missed"),
    CheckInStatus.TIMEOUT: _("timeout"),
}

# Exists due to the vowel differences (A vs An) in the statuses
SINGULAR_HUMAN_FAILURE_MAP: Mapping[int, _StrPromise] = {
    CheckInStatus.ERROR: _("An error check-in was detected"),
    CheckInStatus.MISSED: _("A missed check-in was detected"),
    CheckInStatus.TIMEOUT: _("A timeout check-in was detected"),
}


def get_failure_reason(failed_checkins: Sequence[MonitorCheckIn]):
    """
    Builds a human readable string from a list of failed check-ins.

    "3 missed check-ins detected"
    "2 missed check-ins, 1 timeout check-in and 1 error check-in were detected"
    "A failed check-in was detected"
    """

    status_counts = Counter(
        checkin.status
        for checkin in failed_checkins
        if checkin.status in HUMAN_FAILURE_STATUS_MAP.keys()
    )

    if sum(status_counts.values()) == 1:
        return SINGULAR_HUMAN_FAILURE_MAP[list(status_counts.keys())[0]]

    human_status = get_text_list(
        [
            "%(count)d %(status)s" % {"count": count, "status": HUMAN_FAILURE_STATUS_MAP[status]}
            for status, count in status_counts.items()
        ],
        last_word=_("and"),
    )

    return _("%(problem_checkins)s check-ins detected") % {"problem_checkins": human_status}


def get_monitor_environment_context(monitor_environment: MonitorEnvironment):
    config = monitor_environment.monitor.config.copy()
    if "schedule_type" in config:
        config["schedule_type"] = monitor_environment.monitor.get_schedule_type_display()

    return {
        "id": str(monitor_environment.monitor.guid),
        "slug": str(monitor_environment.monitor.slug),
        "name": monitor_environment.monitor.name,
        "config": monitor_environment.monitor.config,
        "status": monitor_environment.get_status_display(),
        "type": monitor_environment.monitor.get_type_display(),
    }


def resolve_incident_group(incident: MonitorIncident, project_id: int):
    status_change = StatusChangeMessage(
        fingerprint=[incident.grouphash],
        project_id=project_id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )
    produce_occurrence_to_kafka(
        payload_type=PayloadType.STATUS_CHANGE,
        status_change=status_change,
    )
