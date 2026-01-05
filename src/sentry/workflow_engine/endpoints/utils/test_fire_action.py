import logging

import sentry_sdk

from sentry.shared_integrations.exceptions import IntegrationFormError
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


def test_fire_action(action: Action, event_data: WorkflowEventData) -> list[str]:
    """
    This function will fire an action and return a list of exceptions that occurred.
    """
    action_exceptions = []
    try:
        action.trigger(event_data)
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
