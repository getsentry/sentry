import logging

from sentry.models import ExternalActor, NotificationSetting, Team
from sentry.types.integrations import ExternalProviders

logger = logging.getLogger("sentry.integrations.notifications")

SUCCESS_UNLINKED_TEAM_TITLE = "Team unlinked"
SUCCESS_UNLINKED_TEAM_MESSAGE = (
    "This channel will no longer receive issue alert notifications for the {team} team."
)


class NotifyBasicMixin:
    def send_message(self, channel_id: str, message: str) -> None:
        """
        Send a message through the integration.
        """
        raise NotImplementedError

    def notify_remove_external_team(self, external_team: ExternalActor, team: Team) -> None:
        """
        Notify through the integration that an external team has been removed.
        """
        self.send_message(
            channel_id=external_team.external_id,
            message=SUCCESS_UNLINKED_TEAM_MESSAGE.format(team=team.slug),
        )

    def remove_notification_settings(self, actor_id: int, provider: ExternalProviders) -> None:
        """
        Delete notification settings based on an actor_id
        There is no foreign key relationship so we have to manually cascade.
        """
        NotificationSetting.objects._filter(target_ids=[actor_id], provider=provider).delete()
