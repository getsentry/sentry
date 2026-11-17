from __future__ import annotations

from django.conf import settings
from django.core.signing import TimestampSigner
from django.utils import timezone

from sentry.integrations.aws.client import AWS_STATUS_ERROR, AwsVerifyConnectionResult

VERIFICATION_MAX_AGE_SECONDS = 5 * 60


def verification_fields(result: AwsVerifyConnectionResult | None) -> dict[str, str | None]:
    if result is None:
        return {
            "connection_status": AWS_STATUS_ERROR,
            "error_detail": "Verification failed to run during setup.",
            "last_verified_at": None,
        }
    return {
        "connection_status": result["connection_status"],
        "error_detail": result.get("error_detail"),
        "last_verified_at": timezone.now().isoformat(),
    }


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
