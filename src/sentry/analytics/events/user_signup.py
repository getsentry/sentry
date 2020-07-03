from __future__ import absolute_import, print_function

from sentry import analytics


class UserSignUpEvent(analytics.Event):
    type = "user.signup"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("source"),
        analytics.Attribute("provider", required=False),
        analytics.Attribute("referrer", required=False),
    )


analytics.register(UserSignUpEvent)
