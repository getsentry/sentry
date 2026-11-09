import time

from django.contrib.sessions.backends.base import SessionBase

from sentry.api.helpers.oauth_authorize.request import AuthorizationRequest
from sentry.api.helpers.oauth_authorize.response import OAuthRedirectError, authorization_error
from sentry.utils.auth import AUTH_TIME_SESSION_KEY

# prompt=login accepts only a sign-in this recent: long enough for the sign-in
# that the flow itself requested, too short for an existing session.
PROMPT_LOGIN_MAX_AGE = 60


def prompt_error(authorization: AuthorizationRequest, name: str) -> OAuthRedirectError:
    return authorization_error(
        response_type=authorization.response_type,
        redirect_uri=authorization.redirect_uri,
        name=name,
        state=authorization.state,
        client_id=authorization.application.client_id,
    )


def requires_explicit_consent(authorization: AuthorizationRequest) -> bool:
    return not authorization.prompt.isdisjoint(("consent", "select_account"))


def requires_reauthentication(authorization: AuthorizationRequest, session: SessionBase) -> bool:
    if "login" not in authorization.prompt:
        return False

    auth_time = session.get(AUTH_TIME_SESSION_KEY)
    return not isinstance(auth_time, (int, float)) or time.time() - auth_time > PROMPT_LOGIN_MAX_AGE
