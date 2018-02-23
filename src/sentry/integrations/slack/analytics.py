from __future__ import absolute_import, print_function

from sentry import analytics


class SlackIntegrationAction(analytics.Event):
    type = 'integrations.slack.action'

    attributes = (
        analytics.Attribute('action_type'),
        analytics.Attribute('actor_id', required=False),
    )


analytics.register(SlackIntegrationAction)
