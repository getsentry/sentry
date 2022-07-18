from .base import MSTeamsMessageBuilder


class MSTeamsNotificationsMessageBuilder:
    def __init__(self, notification, context, recipient):
        self.notification = notification
        self.context = context
        self.recipient = recipient

    def build():
        return MSTeamsMessageBuilder(title="hello world").build()
