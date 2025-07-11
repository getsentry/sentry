import logging
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.create_feedback import create_feedback_issue
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def save_event_feedback(event_data: Mapping[str, Any], project_id: int):
    """Saves feedback given data in an event format. This function should only be called by the new feedback consumer's ingest strategy, to process feedback envelopes (feedback v2).
    It is currently instrumented as a task in sentry.tasks.store.

    If the save is successful and the `associated_event_id` field is present, this will
    also save a UserReport in Postgres (shim to v1). This is to allow queries by the group_id relation, which we don't have in clickhouse.
    """
    if not isinstance(event_data, dict):
        event_data = dict(event_data)

    # Produce to issue platform
    fixed_event_data = create_feedback_issue(
        event_data, project_id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    if not fixed_event_data:
        return

    try:
        # Shim to UserReport
        # TODO: this logic should be extracted to a shim_to_userreport function which returns a report dict. After that this function can be removed and the store task can directly call feedback ingest functions.
        feedback_context = fixed_event_data["contexts"]["feedback"]
        associated_event_id = feedback_context.get("associated_event_id")

        if associated_event_id:
            project = Project.objects.get_from_cache(id=project_id)
            environment = Environment.objects.get(
                organization_id=project.organization_id,
                name=fixed_event_data.get("environment", "production"),
            )
            timestamp = fixed_event_data["timestamp"]
            start_time = (
                datetime.fromtimestamp(timestamp, tz=UTC)
                if isinstance(timestamp, float)
                else datetime.fromisoformat(timestamp)
            )
            save_userreport(
                project,
                {
                    "event_id": associated_event_id,
                    "project_id": project_id,
                    # XXX(aliu): including environment ensures the update_user_reports task
                    # will not shim the report back to feedback.
                    "environment_id": environment.id,
                    "name": feedback_context.get("name", ""),
                    "email": feedback_context.get("contact_email", ""),
                    "comments": feedback_context["message"],
                },
                FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
                start_time=start_time,
            )
            metrics.incr("feedback.shim_to_userreport.success")

    except Conflict:
        pass

    except Exception:
        metrics.incr("feedback.shim_to_userreport.failed")
        logger.exception(
            "Error shimming from feedback event to user report.",
            extra={
                "associated_event_id": associated_event_id,
                "project_id": project_id,
                "environment_id": fixed_event_data.get("environment"),
                "username": feedback_context.get("name"),
                "email": feedback_context.get("contact_email"),
                "comments": feedback_context.get("message"),
            },
        )
