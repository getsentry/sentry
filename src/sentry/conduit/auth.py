import time
import uuid
from typing import NamedTuple

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
        issuer = settings.CONDUIT_JWT_ISSUER
    if audience is None:
        audience = settings.CONDUIT_JWT_AUDIENCE
    if conduit_private_key is None:
        conduit_private_key = settings.CONDUIT_PRIVATE_KEY
        if conduit_private_key is None:
            raise ValueError("CONDUIT_PRIVATE_KEY not configured")

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
    return jwt.encode(payload, conduit_private_key, algorithm="RS256")


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
