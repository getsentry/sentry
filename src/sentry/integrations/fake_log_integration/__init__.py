from sentry.rules import rules

from .actions import FakeLogAction

# Register the action as a rule action, provider name is "fake-log"
rules.add(FakeLogAction)
