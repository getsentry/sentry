from __future__ import annotations

import hmac
from hashlib import sha256
from typing import List, Mapping

from django.conf import settings

PROXY_BASE_PATH = "/api/0/internal/integration-proxy"
PROXY_OI_HEADER = "X-Sentry-Subnet-Organization-Integration"
PROXY_SIGNATURE_HEADER = "X-Sentry-Subnet-Signature"

INVALID_PROXY_HEADERS = ["Host", "Content-Length"]
INVALID_OUTBOUND_HEADERS = INVALID_PROXY_HEADERS + [
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
]

DEFAULT_REQUEST_BODY = b""


def trim_leading_slashes(path: str) -> str:
    if path.startswith("/"):
        path = path.lstrip("/")
    return path


def clean_headers(
    headers: Mapping[str, str] | None, invalid_headers: List[str]
) -> Mapping[str, str]:
    if not headers:
        headers = {}
    modified_headers = {**headers}
    for invalid_header in invalid_headers:
        modified_headers.pop(invalid_header, None)
    return modified_headers


def clean_proxy_headers(headers: Mapping[str, str] | None) -> Mapping[str, str]:
    return clean_headers(headers, invalid_headers=INVALID_PROXY_HEADERS)


def clean_outbound_headers(headers: Mapping[str, str] | None) -> Mapping[str, str]:
    return clean_headers(headers, invalid_headers=INVALID_OUTBOUND_HEADERS)


def encode_subnet_signature(
    secret: str,
    path: str,
    identifier: str,
    request_body: bytes | None,
) -> str:
    """v0: Silo subnet signature encoding"""
    if request_body is None:
        request_body = DEFAULT_REQUEST_BODY
    raw_signature = b"v0|%s|%s|%s" % (
        trim_leading_slashes(path).encode("utf-8"),
        identifier.encode("utf-8"),
        request_body,
    )
    signature = hmac.new(secret.encode("utf-8"), raw_signature, sha256).hexdigest()
    return f"v0={signature}"


def verify_subnet_signature(
    path: str,
    identifier: str,
    request_body: bytes | None,
    provided_signature: str,
) -> bool:
    """v0: Silo subnet signature decoding and verification"""
    secret = getattr(settings, "SENTRY_SUBNET_SECRET")
    if not secret:
        return False

    assembled_signature = encode_subnet_signature(secret, path, identifier, request_body)

    return hmac.compare_digest(
        assembled_signature.encode("utf-8"), provided_signature.encode("utf-8")
    )
