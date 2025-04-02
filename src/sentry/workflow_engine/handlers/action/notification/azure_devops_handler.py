from sentry.integrations.types import IntegrationProviderSlug
from sentry.workflow_engine.handlers.action.notification.base import TicketingActionHandler
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.AZURE_DEVOPS)
class AzureDevopsActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = IntegrationProviderSlug.AZURE_DEVOPS
