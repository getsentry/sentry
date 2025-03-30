from sentry.rules import rules

from .actions import FakeLogAction
from .log_provider import FakeLogIntegration, FakeLogIntegrationProvider
from .metric_alerting import FakeLogActionHandler
from .spike_protection_registry import FakeLogIntegrationRegistration

__all__ = (
    "FakeLogAction",
    "FakeLogIntegration",
    "FakeLogIntegrationProvider",
    "FakeLogIntegrationRegistration",
    "FakeLogActionHandler",
)

# Register the action as a rule action, provider name is "fake-log"
rules.add(FakeLogAction)
