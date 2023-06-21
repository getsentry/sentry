import secrets
from base64 import b64decode, b64encode
from datetime import datetime

from django.conf import settings

from sentry.utils import json

SENTRY_ORG_AUTH_TOKEN_PREFIX = "sntrys_"


def generate_token(org_slug: str, region_url: str):
    sentry_url = settings.SENTRY_OPTIONS.get("system.url-prefix")
    payload = {
        "iat": datetime.utcnow().timestamp(),
        "url": sentry_url,
        "region_url": region_url,
        "org": org_slug,
    }
    secret = b64encode(secrets.token_urlsafe(nbytes=32).encode("utf-8"))

    json_str = json.dumps(payload)
    payload_hashed = base64_encode_str(json_str)

    return f"{SENTRY_ORG_AUTH_TOKEN_PREFIX}{payload_hashed}_{secret}"


def parse_token(token: str):
    if not token.startswith(SENTRY_ORG_AUTH_TOKEN_PREFIX) or token.count("_") != 2:
        return None

    # Note: We add == to the end of the string, because we remove the base64 padding when generating the token
    # But python expects the correct amount of padding to be present, erroring out otherwise
    # However, any _excess_ padding is ignored, so we just add the max. amount of padding and it works
    payload_hashed = token[len(SENTRY_ORG_AUTH_TOKEN_PREFIX) : token.rindex("_")] + "=="

    try:
        payload_str = b64decode((payload_hashed).encode("ascii")).decode("ascii")
        payload = json.loads(payload_str)
        if not payload.get("iat"):
            return None
        return payload
    except Exception:
        return None


def base64_encode_str(str):
    return b64encode(str.encode("ascii")).decode("ascii").rstrip("=")
