from typing import int
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.notification_action.action_handler_registry.base import (
    TicketingActionHandler,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.JIRA)
class JiraActionHandler(TicketingActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = IntegrationProviderSlug.JIRA
