from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import TicketingIssueAlertHandler
from sentry.workflow_engine.models import Action


@issue_alert_handler_registry.register(Action.Type.AZURE_DEVOPS)
class AzureDevopsIssueAlertHandler(TicketingIssueAlertHandler):
    label_template = "Create an Azure DevOps work item in {integration} with these "
