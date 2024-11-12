from __future__ import annotations

import logging
import uuid
from collections import Counter
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from django.utils.text import get_text_list
from django.utils.translation import gettext_lazy as _

from sentry.issues.grouptype import MonitorIncidentType
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
)
from sentry.monitors.types import SimpleCheckIn

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise

logger = logging.getLogger(__name__)


def create_incident_occurrence(
    failed_checkins: Sequence[SimpleCheckIn],
    failed_checkin: MonitorCheckIn,
    incident: MonitorIncident,
    received: datetime | None,
) -> None:
    from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
    from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka

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
                value=str(get_failure_reason(failed_checkins)),
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
        # We set this to the time that the checkin that triggered the occurrence was written to relay if available
        "received": (received if received else current_timestamp).isoformat(),
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


def get_failure_reason(failed_checkins: Sequence[SimpleCheckIn]):
    """
    Builds a human readable string from a list of failed check-ins.

    "3 missed check-ins detected"
    "2 missed check-ins, 1 timeout check-in and 1 error check-in were detected"
    "A failed check-in was detected"
    """

    status_counts = Counter(
        checkin["status"]
        for checkin in failed_checkins
        if checkin["status"] in HUMAN_FAILURE_STATUS_MAP.keys()
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
