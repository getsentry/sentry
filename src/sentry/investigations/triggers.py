"""
Interim entrypoint for starting investigations headlessly from inside Sentry,
such as from an alert action.

The planned Investigations API will accept any Sentry object (plus optional
hints) and return a run to poll. Until it exists, this maps the subjects we can
already describe onto the agentic investigation services. Callers should only
depend on `trigger_investigation` and its result type so the implementation
can be replaced without touching them.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sentry.incidents.grouptype import MetricIssue
from sentry.investigations.models import Investigation
from sentry.investigations.services import (
    InvestigationSourceNotFound,
    create_agentic_breached_metric_investigation,
    create_agentic_manual_investigation,
    resolve_investigation_source,
)
from sentry.investigations.telemetry import record_investigation_started
from sentry.models.group import Group
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.utils import metrics

logger = logging.getLogger(__name__)


class InvestigationTriggerReferrer(StrEnum):
    """Identifies the path that started an investigation, for usage tracking."""

    ALERT_ACTION = "alert_action"


@dataclass(frozen=True)
class TriggeredInvestigation:
    investigation: Investigation
    # False when an active investigation already covers the same subject.
    created: bool


def _record(referrer: InvestigationTriggerReferrer, source_type: str, outcome: str) -> None:
    metrics.incr(
        "investigations.trigger",
        tags={"referrer": referrer, "source_type": source_type, "outcome": outcome},
        sample_rate=1.0,
    )


def _issue_source(group: Group, event_id: str | None) -> dict[str, Any]:
    event_context = f" (event {event_id})" if event_id else ""
    return {
        "type": "manual",
        "prompt": (
            f"An alert fired for Sentry issue {group.qualified_short_id}: {group.title}"
            f"{event_context}. Investigate what caused it."
        ),
        "seed": {
            "groupTitle": group.title,
            "sentrySource": {
                "type": "issue",
                "groupId": group.id,
                "shortId": group.qualified_short_id,
                "projectId": group.project_id,
                "eventId": event_id,
            },
        },
    }


def trigger_investigation(
    *,
    group: Group,
    user_id: int,
    referrer: InvestigationTriggerReferrer,
    event_id: str | None = None,
) -> TriggeredInvestigation | None:
    """
    Start an investigation for `group`, acting as `user_id`.

    Metric issues are investigated as their current open period, and repeated
    triggers for the same open period return the existing investigation. Other
    issues fall back to a prompt-driven investigation seeded with the issue.

    Returns None when there is nothing to investigate, such as a metric issue
    whose open period has already closed or can no longer be resolved.
    """
    organization = group.project.organization
    project_ids = [group.project_id]

    if group.type == MetricIssue.type_id:
        source_type = "metric_open_period"
        open_period = get_latest_open_period(group)
        if open_period is None or open_period.date_ended is not None:
            _record(referrer, source_type, "skipped_no_open_period")
            return None
        try:
            resolved_source = resolve_investigation_source(
                organization=organization,
                source={
                    "type": source_type,
                    "ref": {"groupId": group.id, "openPeriodId": open_period.id},
                },
                accessible_project_ids=set(project_ids),
            )
        except InvestigationSourceNotFound:
            # The resolver drops metrics it can no longer describe, such as when
            # the detector or its subscription has been removed.
            _record(referrer, source_type, "skipped_unresolvable_source")
            return None
        investigation, created = create_agentic_breached_metric_investigation(
            organization=organization,
            user_id=user_id,
            title=None,
            resolved_source=resolved_source,
            project_ids=project_ids,
            filters={},
        )
    else:
        source_type = "issue"
        investigation, _ = create_agentic_manual_investigation(
            organization=organization,
            user_id=user_id,
            title=None,
            source=_issue_source(group, event_id),
            project_ids=project_ids,
            filters={},
        )
        created = True

    if created:
        record_investigation_started(investigation)
    _record(referrer, source_type, "created" if created else "existing")
    logger.info(
        "investigations.trigger",
        extra={
            "organization_id": organization.id,
            "group_id": group.id,
            "investigation_id": investigation.id,
            "referrer": referrer,
            "source_type": source_type,
            "investigation_created": created,
        },
    )
    return TriggeredInvestigation(investigation=investigation, created=created)
