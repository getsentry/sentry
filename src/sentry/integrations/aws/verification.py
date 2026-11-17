from __future__ import annotations

from django.conf import settings
from django.core.signing import TimestampSigner

VERIFICATION_MAX_AGE_SECONDS = 5 * 60


# Setup crosses silos via the browser. Scope the signature to this operation and
# exact trust relationship; a receipt for different settings must not validate.
def verification_signer(
    *, organization_id: int, role_arn: str, region: str, external_id: str
) -> TimestampSigner:
    # ARNs, region names and Sentry-generated external IDs cannot contain '|'.
    salt = f"sentry.aws-seer.verification.v1|{organization_id}|{role_arn}|{region}|{external_id}"
    # Use the inter-silo signing keys (including rotation). A standalone installation
    # has no inter-silo key and both sides use its Django signing key instead.
    keys = settings.RPC_SHARED_SECRET
    if keys:
        fallback_keys: list[str | bytes] = list(keys[1:])
        return TimestampSigner(salt=salt, key=keys[0], fallback_keys=fallback_keys)
    return TimestampSigner(salt=salt)
