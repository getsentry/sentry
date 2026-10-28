import logging
from collections.abc import Mapping
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

logger = logging.getLogger("sentry.oauth")


class InvalidAuthorizationRequest(Exception):
    """An authorization error that must be displayed in Sentry."""

    def __init__(self, public_message: str, *, parameter: str | None = None) -> None:
        self.parameter = parameter
        self.public_message = public_message
        super().__init__(public_message)


class OAuthRedirectError(Exception):
    """An OAuth error delivered to a validated application callback."""

    def __init__(self, redirect_url: str) -> None:
        self.redirect_url = redirect_url
        super().__init__(redirect_url)


def build_redirect_url(
    response_type: str | None,
    redirect_uri: str,
    params: Mapping[str, str | int | None],
) -> str:
    values = [(key, str(value)) for key, value in params.items() if value is not None]
    if response_type == "token":
        return f"{redirect_uri}#{urlencode(values)}"

    parts = list(urlparse(redirect_uri))
    parts[4] = urlencode([*parse_qsl(parts[4]), *values])
    return urlunparse(parts)


def authorization_error(
    *,
    response_type: str | None,
    redirect_uri: str,
    name: str,
    state: str | None,
    client_id: str | None = None,
) -> OAuthRedirectError:
    logger.error(
        "oauth.authorize-error",
        extra={
            "error_name": name,
            "response_type": response_type,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
        },
    )
    return OAuthRedirectError(
        build_redirect_url(response_type, redirect_uri, {"error": name, "state": state})
    )
