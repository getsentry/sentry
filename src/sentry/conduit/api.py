from django.http.response import HttpResponseBase

from sentry.conduit.auth import ConduitCredentials, get_conduit_credentials

CONDUIT_TOKEN_HEADER = "X-Conduit-Token"
CONDUIT_CHANNEL_ID_HEADER = "X-Conduit-Channel-Id"
CONDUIT_URL_HEADER = "X-Conduit-Url"


def add_conduit_response_headers(
    response: HttpResponseBase,
    organization_id: int,
    *,
    channel_id: str | None = None,
) -> ConduitCredentials | None:
    """Attach the credentials needed by conduit-client to an API response."""
    try:
        credentials = get_conduit_credentials(organization_id, channel_id=channel_id)
    except ValueError:
        return None

    response.headers[CONDUIT_TOKEN_HEADER] = credentials.token
    response.headers[CONDUIT_CHANNEL_ID_HEADER] = credentials.channel_id
    response.headers[CONDUIT_URL_HEADER] = credentials.url
    return credentials
