from sentry.rules import rules

from .actions import FakeLogAction
from .log_provider import FakeLogIntegration, FakeLogIntegrationProvider

__all__ = ("FakeLogAction", "FakeLogIntegration", "FakeLogIntegrationProvider")

# Register the action as a rule action, provider name is "fake-log"
rules.add(FakeLogAction)
