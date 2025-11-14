from typing import int
from sentry import analytics


@analytics.eventclass("team.created")
class TeamCreatedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | str | None = None
    organization_id: int
    team_id: int


analytics.register(TeamCreatedEvent)
