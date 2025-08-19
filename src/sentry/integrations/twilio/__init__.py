from sentry.rules import rules

from .actions import TwilioNotifyServiceAction
from .integration import TwilioIntegrationProvider

__all__ = (
    "TwilioAction",
    "TwilioIntegrationProvider",
)

# Register the action as a rule action, provider name is "fake-log"
rules.add(TwilioNotifyServiceAction)
