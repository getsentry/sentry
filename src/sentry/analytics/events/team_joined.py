from __future__ import absolute_import

from sentry import analytics


class TeamJoinedEvent(analytics.Event):
    type = 'team.joined'

    attributes = (
        analytics.Attribute('user_id'),
        analytics.Attribute('organization_id'),
        analytics.Attribute('team_id'),
    )


analytics.register(TeamJoinedEvent)
