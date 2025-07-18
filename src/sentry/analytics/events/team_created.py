from sentry import analytics


@analytics.eventclass("team.created")
class TeamCreatedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    team_id: str


analytics.register(TeamCreatedEvent)
