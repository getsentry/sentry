from datetime import datetime
from uuid import uuid4

from django.conf import settings

from sentry.utils import jwt

SENTRY_JWT_PREFIX = "sntrys_"


def generate_token(org_slug: str, region_url: str):
    jwt_payload = {
        "iss": "sentry.io",
        "iat": datetime.utcnow(),
        "nonce": uuid4().hex,
        "sentry_url": settings.SENTRY_OPTIONS["system.url-prefix"],
        "sentry_region_url": region_url,
        "sentry_org": org_slug,
    }
    jwt_token = jwt.encode(jwt_payload, "", algorithm="none")
    return f"{SENTRY_JWT_PREFIX}{jwt_token}"


def parse_token(token: str):
    if not token.startswith(SENTRY_JWT_PREFIX):
        return None
    token = token[7:]
    try:
        jwt_payload = jwt.peek_claims(token)
        if jwt_payload.get("iss") != "sentry.io":
            return None
        return jwt_payload
    except jwt.DecodeError:
        return None
