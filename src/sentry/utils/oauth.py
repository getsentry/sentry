from __future__ import annotations

import re

__all__ = ["KNOWN_OAUTH_ERROR_CODES", "sanitize_oauth_error_code"]

_MAX_ERROR_LENGTH = 64
_INVALID_ERROR_CHARS_RE = re.compile(r"[^a-z0-9._-]")

# Common error codes returned by OAuth/OIDC providers. This list combines values from
# RFC 6749, RFC 8628, and popular provider-specific extensions so we can safely display
# known codes back to the user.
KNOWN_OAUTH_ERROR_CODES = frozenset(
    {
        "account_selection_required",
        "access_denied",
        "authorization_pending",
        "consent_required",
        "expired_token",
        "interaction_required",
        "invalid_client",
        "invalid_grant",
        "invalid_request",
        "invalid_scope",
        "login_required",
        "mfa_enrollment_required",
        "mfa_required",
        "registration_not_supported",
        "server_error",
        "slow_down",
        "temporarily_unavailable",
        "unauthorized_client",
        "unsupported_response_type",
        "user_cancelled_authorize",
    }
)


def sanitize_oauth_error_code(error: str | None) -> str | None:
    """
    Normalize an OAuth error code so it is safe to log or compare.

    - Downcases the value
    - Removes all characters outside of ``[a-z0-9._-]``
    - Truncates overly long values
    """

    if not error:
        return None

    sanitized = _INVALID_ERROR_CHARS_RE.sub("", error.lower())
    sanitized = sanitized[:_MAX_ERROR_LENGTH]
    return sanitized or None
