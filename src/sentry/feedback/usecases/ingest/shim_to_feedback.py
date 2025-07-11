from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from sentry.constants import DataCategory
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.lib.utils import FeedbackCreationSource, is_in_feedback_denylist
from sentry.feedback.usecases.create_feedback import create_feedback_issue
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def shim_to_feedback(
    report: UserReportDict,
    event: Event | GroupEvent,
    project: Project,
    source: FeedbackCreationSource,
):
    """
    takes user reports from the legacy user report form/endpoint and
    user reports that come from relay envelope ingestion and
    creates a new User Feedback from it.
    User feedbacks are an event type, so we try and grab as much from the
    legacy user report and event to create the new feedback.
    """
    if is_in_feedback_denylist(project.organization):
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="feedback_denylist",
            timestamp=datetime.fromisoformat(event.timestamp),
            event_id=event.event_id,
            category=DataCategory.USER_REPORT_V2,
            quantity=1,
        )
        return

    try:
        name = (
            report.get("name")
            or get_path(event.data, "user", "name")
            or get_path(event.data, "user", "username")
            or ""
        )
        contact_email = report.get("email") or get_path(event.data, "user", "email") or ""

        feedback_event: dict[str, Any] = {
            "contexts": {
                "feedback": {
                    "name": name,
                    "contact_email": contact_email,
                    "message": report["comments"],
                    "associated_event_id": event.event_id,
                },
            },
        }

        if get_path(event.data, "contexts", "replay", "replay_id"):
            feedback_event["contexts"]["replay"] = event.data["contexts"]["replay"]
            feedback_event["contexts"]["feedback"]["replay_id"] = event.data["contexts"]["replay"][
                "replay_id"
            ]

        if get_path(event.data, "contexts", "trace", "trace_id"):
            feedback_event["contexts"]["trace"] = event.data["contexts"]["trace"]

        feedback_event["timestamp"] = event.datetime.timestamp()
        feedback_event["platform"] = event.platform
        feedback_event["level"] = event.data["level"]
        feedback_event["environment"] = event.get_environment().name
        feedback_event["tags"] = [list(item) for item in event.tags]

        # Entrypoint for "new" (issue platform based) feedback. This emits outcomes.
        create_feedback_issue(feedback_event, project.id, source)
    except Exception:
        logger.exception("Error attempting to create new user feedback by shimming a user report")
        metrics.incr("feedback.shim_to_feedback.failed", tags={"referrer": source.value})
