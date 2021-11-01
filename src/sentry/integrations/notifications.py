import logging

from sentry.models import NotificationSetting
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger("sentry.integrations.notifications")


class NotifyBasicMixin:
    def notify_remove_external_team(self, external_team, team):
        """
        Notify through the integration that an external team has been removed.
        """
        raise NotImplementedError

    def remove_notification_settings(self, actor_id):
        """
        Delete notification settings based on an actor_id
        """
        NotificationSetting.objects._filter(
            target_ids=[self.actor_id], provider=ExternalProviders(self.provider)
        ).delete()
