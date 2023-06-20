from datetime import datetime
from uuid import uuid4

from django.conf import settings

from sentry.utils import jwt

SENTRY_JWT_PREFIX = "sntrys_"


def generate_token(org_slug: str, region_url: str):
    sentry_url = settings.SENTRY_OPTIONS.get("system.url-prefix")

    jwt_payload = {
        "iss": "sentry.io",
        "iat": datetime.utcnow().timestamp(),
        "sentry_url": sentry_url,
        "sentry_region_url": region_url,
        "sentry_org": org_slug,
        "nonce": uuid4().hex,
    }
    jwt_token = jwt.encode(jwt_payload, "", algorithm="none")
    return f"{SENTRY_JWT_PREFIX}{jwt_token}"


def parse_token(token: str):
    if not token.startswith(SENTRY_JWT_PREFIX):
        return None
    jwt_token = token[7:]

    try:
        jwt_payload = jwt.peek_claims(jwt_token)
        if jwt_payload.get("iss") != "sentry.io":
            return None
        return jwt_payload
    except jwt.DecodeError:
        # Special case: If the token does not end with `.`, we try again with it added
        # This is done to help users that do not copy the dot, as it may be unexpected to have a trailing dot
        # We have trailing dots because we use `None` algorithm
        if token.endswith(".") is False:
            return parse_token(token + ".")
        return None
