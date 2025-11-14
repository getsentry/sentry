import base64
import binascii
import time
import uuid
from typing import int, NamedTuple

from django.conf import settings

from sentry.utils import jwt, metrics

TOKEN_TTL_SEC = 600  # 10 minutes


class ConduitCredentials(NamedTuple):
    token: str
    channel_id: str
    url: str


def generate_channel_id() -> str:
    """Generate a unique channel ID for a Conduit stream."""
    return str(uuid.uuid4())


def generate_conduit_token(
    org_id: int,
    channel_id: str,
    issuer: str | None = None,
    audience: str | None = None,
    conduit_private_key: str | None = None,
) -> str:
    """
    Generate a JWT token for Conduit authentication.

    Optional parameters default to settings values if not provided.

    Returns:
        JWT token string
    """
    if issuer is None:
        issuer = settings.CONDUIT_GATEWAY_JWT_ISSUER
    if audience is None:
        audience = settings.CONDUIT_GATEWAY_JWT_AUDIENCE
    if conduit_private_key is None:
        conduit_private_key = settings.CONDUIT_GATEWAY_PRIVATE_KEY
        if conduit_private_key is None:
            raise ValueError("CONDUIT_GATEWAY_PRIVATE_KEY not configured")
    try:
        conduit_private_key_decoded = base64.b64decode(conduit_private_key).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError) as e:
        raise ValueError("CONDUIT_GATEWAY_PRIVATE_KEY is not valid base64") from e

    now = int(time.time())
    exp = now + TOKEN_TTL_SEC
    payload = {
        "org_id": org_id,
        "channel_id": channel_id,
        "iat": now,
        # Conduit only validates tokens on initial connection, not for stream lifetime
        "exp": exp,
        "iss": issuer,
        "aud": audience,
    }
    return jwt.encode(payload, conduit_private_key_decoded, algorithm="RS256")


def get_conduit_credentials(
    org_id: int,
    gateway_url: str | None = None,
) -> ConduitCredentials:
    """
    Generate all credentials needed to connect to Conduit.

    Returns:
        ConduitCredentials containing authentication details
    """
    if gateway_url is None:
        gateway_url = settings.CONDUIT_GATEWAY_URL
    channel_id = generate_channel_id()
    token = generate_conduit_token(org_id, channel_id)

    metrics.incr(
        "conduit.credentials.generated",
        sample_rate=1.0,
    )

    return ConduitCredentials(
        token=token,
        channel_id=channel_id,
        url=f"{gateway_url}/events/{org_id}",
    )
