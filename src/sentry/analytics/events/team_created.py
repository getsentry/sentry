from __future__ import absolute_import

from sentry import analytics


class TeamCreatedEvent(analytics.Event):
    type = "team.created"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("team_id"),
    )


analytics.register(TeamCreatedEvent)
