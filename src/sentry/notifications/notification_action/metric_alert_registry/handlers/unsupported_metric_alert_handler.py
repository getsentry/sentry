import logging

from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation

logger = logging.getLogger(__name__)


@metric_alert_handler_registry.register(Action.Type.GITHUB)
@metric_alert_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
@metric_alert_handler_registry.register(Action.Type.JIRA)
@metric_alert_handler_registry.register(Action.Type.JIRA_SERVER)
@metric_alert_handler_registry.register(Action.Type.AZURE_DEVOPS)
class UnsupportedMetricAlertHandler(BaseMetricAlertHandler):
    """
    Ticketing actions (GitHub, GitHub Enterprise, Jira, Jira Server, Azure DevOps) don't
    support metric alerts / metric issues. The UI already tells users that this action is
    incompatible with the current configuration when they attach a ticketing action to a
    metric alert, so this handler no-ops instead of raising NoRegistrationExistsError.
    """

    @classmethod
    def invoke_legacy_registry(cls, invocation: ActionInvocation) -> None:
        logger.info(
            "notification_action.metric_alert.unsupported",
            extra={
                "action_id": invocation.action.id,
                "action_type": invocation.action.type,
                "detector_id": invocation.detector.id,
            },
        )
