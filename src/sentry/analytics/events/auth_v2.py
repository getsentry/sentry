from sentry import analytics
from sentry.analytics import Event, eventclass


@eventclass("auth_v2.csrf_token.rotated")
class AuthV2CsrfTokenRotated(Event):
    event: str


@eventclass("auth_v2.csrf_token.delete_login")
class AuthV2DeleteLogin(Event):
    event: str


analytics.register(AuthV2CsrfTokenRotated)
analytics.register(AuthV2DeleteLogin)
