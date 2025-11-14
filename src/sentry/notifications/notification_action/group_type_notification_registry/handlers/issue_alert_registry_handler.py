from typing import int
import logging

from sentry.grouping.grouptype import ErrorGroupType
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
)
from sentry.notifications.notification_action.types import LegacyRegistryHandler
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowEventData

logger = logging.getLogger(__name__)


@group_type_notification_registry.register(ErrorGroupType.slug)
class IssueAlertRegistryHandler(LegacyRegistryHandler):
    @staticmethod
    def handle_workflow_action(job: WorkflowEventData, action: Action, detector: Detector) -> None:
        try:
            handler = issue_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector)
        except NoRegistrationExistsError:
            logger.exception(
                "No issue alert handler found for action type: %s",
                action.type,
                extra={"action_id": action.id},
            )
            raise
        except Exception:
            logger.exception(
                "Error invoking issue alert handler",
                extra={"action_id": action.id},
            )
            raise
