from sentry import analytics


@analytics.eventclass("user.signup")
class UserSignUpEvent(analytics.Event):
    user_id: str
    source: str
    provider: str | None = None
    referrer: str | None = None


class RelocationUserSignUpEvent(UserSignUpEvent):
    type = "relocation.user_signup"


analytics.register(UserSignUpEvent)
analytics.register(RelocationUserSignUpEvent)
