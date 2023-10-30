import secrets
from base64 import b64decode, b64encode
from datetime import datetime

from sentry import options
from sentry.utils import hashlib, json

SENTRY_ORG_AUTH_TOKEN_PREFIX = "sntrys_"


class SystemUrlPrefixMissingException(Exception):
    # system.url-prefix is not set. You need to set this to generate a token.
    pass


def generate_token(org_slug: str, region_url: str):
    sentry_url = options.get("system.url-prefix")

    if sentry_url is None:
        raise SystemUrlPrefixMissingException

    payload = {
        "iat": datetime.utcnow().timestamp(),
        "url": sentry_url,
        "region_url": region_url,
        "org": org_slug,
    }
    secret = b64encode(secrets.token_bytes(nbytes=32)).decode("ascii").rstrip("=")

    json_str = json.dumps(payload)
    payload_encoded = base64_encode_str(json_str)

    return f"{SENTRY_ORG_AUTH_TOKEN_PREFIX}{payload_encoded}_{secret}"


def parse_token(token: str):
    if not token.startswith(SENTRY_ORG_AUTH_TOKEN_PREFIX) or token.count("_") != 2:
        return None

    payload_hashed = token[len(SENTRY_ORG_AUTH_TOKEN_PREFIX) : token.rindex("_")]

    try:
        payload_str = b64decode((payload_hashed).encode("ascii")).decode("ascii")
        payload = json.loads(payload_str)
        if not payload.get("iat"):
            return None
        return payload
    except Exception:
        return None


def base64_encode_str(str):
    return b64encode(str.encode("ascii")).decode("ascii")


def hash_token(token: str):
    return hashlib.sha256_text(token).hexdigest()
