from sentry import analytics


@analytics.eventclass("auth_v2.csrf_token.rotated")
class AuthV2CsrfTokenRotated(analytics.Event):
    event: str


@analytics.eventclass("auth_v2.csrf_token.delete_login")
class AuthV2DeleteLogin(analytics.Event):
    event: str


analytics.register(AuthV2CsrfTokenRotated)
analytics.register(AuthV2DeleteLogin)
