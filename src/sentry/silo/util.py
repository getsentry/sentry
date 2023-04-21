from __future__ import annotations

import hmac
import re
from hashlib import sha256
from typing import Any, Mapping

from django.conf import settings

INVALID_PROXY_HEADERS = ["Host"]


def clean_proxy_headers(headers: Mapping[str, Any] | None) -> Mapping[str, Any]:
    if not headers:
        headers = {}
    modified_headers = {**headers}
    for invalid_header in INVALID_PROXY_HEADERS:
        modified_headers.pop(invalid_header, None)
    return modified_headers


def trim_leading_slash(path: str) -> str:
    result = re.search(r"^\/(\S+)", path)
    if result is not None:
        return result.groups()[0]
    return path


def encode_subnet_signature(
    secret: str,
    timestamp: str,
    path: str,
    identifier: str,
    request_body: str | bytes,
) -> str:
    """v0: Silo subnet signature encoding"""
    raw_signature = b"v0|%s|%s|%s|%s" % (
        timestamp.encode("utf-8"),
        trim_leading_slash(path).encode("utf-8"),
        identifier.encode("utf-8"),
        request_body,
    )
    signature = hmac.new(secret.encode("utf-8"), raw_signature, sha256).hexdigest()
    return f"v0={signature}"


def verify_subnet_signature(
    timestamp: str,
    request_body: bytes,
    path: str,
    identifier: str,
    provided_signature: str,
) -> bool:
    """v0: Silo subnet signature decoding and verification"""
    secret = getattr(settings, "SENTRY_SUBNET_SECRET")
    if not secret:
        return False

    assembled_signature = encode_subnet_signature(secret, timestamp, path, identifier, request_body)

    return hmac.compare_digest(
        assembled_signature.encode("utf-8"), provided_signature.encode("utf-8")
    )
