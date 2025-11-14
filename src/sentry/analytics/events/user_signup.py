from typing import int
from sentry import analytics


@analytics.eventclass("user.signup")
class UserSignUpEvent(analytics.Event):
    user_id: int
    source: str
    provider: str | None = None
    referrer: str | None = None


@analytics.eventclass("relocation.user_signup")
class RelocationUserSignUpEvent(UserSignUpEvent):
    pass


analytics.register(UserSignUpEvent)
analytics.register(RelocationUserSignUpEvent)
