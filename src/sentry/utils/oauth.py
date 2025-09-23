from __future__ import annotations

import re

# PKCE helpers shared between OAuth authorize/token views

PKCE_METHOD_S256 = "S256"
PKCE_METHOD_PLAIN = "plain"
PKCE_DEFAULT_METHOD = PKCE_METHOD_PLAIN
_PKCE_CODE_PATTERN = re.compile(r"^[A-Za-z0-9\-\._~]{43,128}$")


def validate_code_challenge(challenge: str | None) -> bool:
    if not challenge:
        return False
    return bool(_PKCE_CODE_PATTERN.match(challenge))


def normalize_pkce_method(method_raw: str | None) -> str | None:
    if not method_raw:
        return PKCE_DEFAULT_METHOD

    method_key = method_raw.upper()
    if method_key == "S256":
        return PKCE_METHOD_S256
    if method_key == "PLAIN":
        return PKCE_METHOD_PLAIN
    return None
