import logging

from sentry.models import ExternalActor, NotificationSetting, Team
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger("sentry.integrations.notifications")


class NotifyBasicMixin:
    def notify_remove_external_team(self, external_team: ExternalActor, team: Team) -> None:
        """
        Notify through the integration that an external team has been removed.
        """
        raise NotImplementedError

    def remove_notification_settings(self, actor_id: int, provider: str) -> None:
        """
        Delete notification settings based on an actor_id
        There is no foreign key relationship so we have to manually cascade.
        """
        NotificationSetting.objects._filter(
            target_ids=[actor_id], provider=ExternalProviders(provider)
        ).delete()
