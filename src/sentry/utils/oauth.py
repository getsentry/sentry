from __future__ import annotations

import string

__all__ = ["sanitize_oauth_error"]

_ALLOWED_OAUTH_ERROR_CHARS = frozenset(string.ascii_letters + string.digits + "-._~")
_MAX_OAUTH_ERROR_LENGTH = 128


def sanitize_oauth_error(error: str | None, *, max_length: int = _MAX_OAUTH_ERROR_LENGTH) -> str | None:
    """
    Normalize an OAuth ``error`` query parameter value.

    The OAuth 2.0 specification (RFC 6749) restricts the ``error`` token to a fixed set
    of short identifiers comprised of unreserved URI characters. To prevent attackers
    from echoing arbitrary strings back to the user or into logs, we only return a value
    if it stays within the allowed character set and length budget. The result is
    lower-cased for consistency.
    """

    if error is None:
        return None

    token = error.strip()
    if not token:
        return None

    if len(token) > max_length:
        return None

    if not set(token).issubset(_ALLOWED_OAUTH_ERROR_CHARS):
        return None

    return token.lower()
