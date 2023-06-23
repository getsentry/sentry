import logging

from sentry.models.integrations.external_actor import ExternalActor
from sentry.models.team import Team

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
