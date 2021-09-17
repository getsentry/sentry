"""
Used for notifying a *specific* sentry app with a custom webhook payload (i.e. specified UI components)
"""
from sentry.rules.actions.base import EventAction


class NotifyEventSentryAppAction(EventAction):
    label = "This label should be received from the schema"
    prompt = "Sentry App Title"
