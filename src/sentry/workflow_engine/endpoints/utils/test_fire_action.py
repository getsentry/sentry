import logging
from datetime import UTC, datetime
from hashlib import md5
from uuid import uuid4

import sentry_sdk

from sentry.event_manager import set_tag
from sentry.eventstore.models import GroupEvent
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.notifications.notification_action.grouptype import SendTestNotification
from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.utils.samples import load_data
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


def test_fire_action(
    action: Action, event_data: WorkflowEventData, detector: Detector
) -> list[str]:
    """
    This function will fire an action and return a list of exceptions that occurred.
    """
    action_exceptions = []
    try:
        action.trigger(
            event_data=event_data,
            detector=detector,
        )
    except Exception as exc:
        if isinstance(exc, IntegrationFormError):
            logger.warning("%s.test_alert.integration_error", action.type, extra={"exc": exc})

            # IntegrationFormErrors should be safe to propagate via the API
            action_exceptions.append(str(exc))
        else:
            # If we encounter some unexpected exception, we probably
            # don't want to continue executing more callbacks.
            logger.warning("%s.test_alert.unexpected_exception", action.type, exc_info=True)
            error_id = sentry_sdk.capture_exception(exc)
            action_exceptions.append(f"An unexpected error occurred. Error ID: '{error_id}'")

    return action_exceptions


def get_test_notification_event_data(project) -> GroupEvent | None:

    occurrence = IssueOccurrence(
        id=uuid4().hex,
        project_id=project.id,
        event_id=uuid4().hex,
        fingerprint=[md5(str(uuid4()).encode("utf-8")).hexdigest()],
        issue_title="Test Issue",
        subtitle="Test issue created to test a notification related action",
        resource_id=None,
        evidence_data={},
        evidence_display=[],
        type=SendTestNotification,
        detection_time=datetime.now(UTC),
        level="error",
        culprit="Test notification",
    )

    # Load mock data
    event_data = load_data(
        platform=project.platform,
        default="javascript",
        event_id=occurrence.event_id,
    )

    # Setting this tag shows the sample event banner in the UI
    set_tag(event_data, "sample_event", "yes")

    event_data["project_id"] = occurrence.project_id

    occurrence, group_info = process_event_and_issue_occurrence(occurrence.to_dict(), event_data)
    if group_info is None:
        return None

    generic_group = group_info.group
    group_event = generic_group.get_latest_event()

    return group_event
