import logging
from datetime import UTC, datetime
from typing import Any

from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, create_feedback_issue
from sentry.ingest.userreport import save_userreport
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


def save_feedback_event(event_data: dict[str, Any], project_id: int):
    """Saves a feedback from a feedback event envelope.

    If the save is successful and the `associated_event_id` field is present, this will
    also save a UserReport in Postgres. This is to ensure the feedback can be queried by
    group_id, which is hard to associate in clickhouse.
    """

    # Produce to issue platform
    fixed_event_data = create_feedback_issue(
        event_data, project_id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    try:
        # Shim to UserReport
        associated_event_id = get_path(
            fixed_event_data, "contexts", "feedback", "associated_event_id"
        )
        if associated_event_id:
            feedback_context = fixed_event_data["contexts"]["feedback"]
            project = Project.objects.get_from_cache(id=project_id)
            save_userreport(
                project,
                {
                    "event_id": associated_event_id,
                    "project_id": project_id,
                    # XXX(aliu): including environment ensures the update_user_reports task
                    # will not shim the report back to feedback.
                    "environment_id": fixed_event_data["environment"],
                    "name": feedback_context["name"],
                    "email": feedback_context["contact_email"],
                    "comments": feedback_context["message"],
                },
                FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
                start_time=datetime.fromtimestamp(fixed_event_data["timestamp"], UTC),
            )
            metrics.incr("feedback.shim_to_userreport.success")
    except Exception:
        metrics.incr("feedback.shim_to_userreport.failed")
        logger.exception("Error saving user report")
