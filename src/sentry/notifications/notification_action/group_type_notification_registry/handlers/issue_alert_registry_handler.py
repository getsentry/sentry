import logging
from typing import override

from sentry.grouping.grouptype import ErrorGroupType
from sentry.notifications.notification_action.registry import (
    group_type_notification_registry,
    issue_alert_handler_registry,
)
from sentry.notifications.notification_action.types import LegacyRegistryHandler
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


@group_type_notification_registry.register(ErrorGroupType.slug)
class IssueAlertRegistryHandler(LegacyRegistryHandler):
    @staticmethod
    @override
    def handle_workflow_action(invocation: ActionInvocation) -> None:
        try:
<<<<<<< HEAD
            handler = issue_alert_handler_registry.get(invocation.action.type)
            handler.invoke_legacy_registry(invocation)
=======
            handler = issue_alert_handler_registry.get(action.type)
            handler.invoke_legacy_registry(job, action, detector, notification_uuid)
>>>>>>> 80f720e8db7 (cleanup)
        except NoRegistrationExistsError:
            logger.exception(
                "No issue alert handler found for action type: %s",
                invocation.action.type,
                extra={"action_id": invocation.action.id},
            )
            raise
        except Exception:
            logger.exception(
                "Error invoking issue alert handler",
                extra={"action_id": invocation.action.id},
            )
            raise
