import logging

logger = logging.getLogger("sentry.integrations.notifications")


class NotifyBasicMixin:
    def notify_remove_external_actor(self, external_actor, message):
        """
        Notify through the integration that settings have been changed on Sentry.
        """
        raise NotImplementedError
