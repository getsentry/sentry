from __future__ import absolute_import, print_function

from sentry import analytics


class UserCreatedEvent(analytics.Event):
    type = "user.created"

    attributes = (
        analytics.Attribute("id"),
        analytics.Attribute("username"),
        analytics.Attribute("email"),
    )


analytics.register(UserCreatedEvent)
