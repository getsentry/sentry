from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import TicketingIssueAlertHandler
from sentry.workflow_engine.models import Action


@issue_alert_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
class GithubEnterpriseIssueAlertHandler(TicketingIssueAlertHandler):
    label_template = "Create a GitHub Enterprise issue in {integration} with these "
