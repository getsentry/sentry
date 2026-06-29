from sentry.integrations.github.handlers.github_handler import GithubActionHandler
from sentry.integrations.types import IntegrationProviderSlug
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.registry import action_handler_registry
from sentry.workflow_engine.types import ActionHandler


@action_handler_registry.register(Action.Type.GITHUB_ENTERPRISE)
class GithubEnterpriseActionHandler(GithubActionHandler):
    group = ActionHandler.Group.TICKET_CREATION
    provider_slug = IntegrationProviderSlug.GITHUB_ENTERPRISE
