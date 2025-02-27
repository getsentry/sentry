from sentry.integrations.utils.metrics import IntegrationEventOutcomeHandler
from sentry.utils.registry import Registry

integration_outcome_handler_registry = Registry[IntegrationEventOutcomeHandler]()
