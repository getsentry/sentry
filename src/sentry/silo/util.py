from __future__ import annotations

import hmac
from hashlib import sha256
from typing import Iterable, Mapping
from wsgiref.util import is_hop_by_hop

from django.conf import settings

PROXY_BASE_PATH = "/api/0/internal/integration-proxy"
PROXY_OI_HEADER = "X-Sentry-Subnet-Organization-Integration"
PROXY_BASE_URL_HEADER = "X-Sentry-Subnet-Base-URL"
PROXY_SIGNATURE_HEADER = "X-Sentry-Subnet-Signature"
PROXY_PATH = "X-Sentry-Subnet-Path"
PROXY_KEYID_HEADER = "X-Sentry-Subnet-Keyid"
PROXY_DIRECT_LOCATION_HEADER = "X-Sentry-Proxy-URL"

INVALID_PROXY_HEADERS = {"Host", "X-Forwarded-Proto", "Content-Length", "Content-Encoding"}
INVALID_OUTBOUND_HEADERS = INVALID_PROXY_HEADERS | {
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    PROXY_BASE_URL_HEADER,
    PROXY_PATH,
}

DEFAULT_REQUEST_BODY = b""


def trim_leading_slashes(path: str) -> str:
    if path.startswith("/"):
        path = path.lstrip("/")
    return path


def clean_headers(
    headers: Mapping[str, str] | None, invalid_headers: Iterable[str]
) -> Mapping[str, str]:
    if not headers:
        headers = {}
    normalized_invalid = {h.lower() for h in invalid_headers}
    modified_headers = {
        h: v
        for h, v in headers.items()
        if h.lower() not in normalized_invalid and not is_hop_by_hop(h)
    }
    return modified_headers


def clean_proxy_headers(headers: Mapping[str, str] | None) -> Mapping[str, str]:
    return clean_headers(headers, invalid_headers=INVALID_PROXY_HEADERS)


def clean_outbound_headers(headers: Mapping[str, str] | None) -> Mapping[str, str]:
    return clean_headers(headers, invalid_headers=INVALID_OUTBOUND_HEADERS)


def encode_subnet_signature(
    secret: str,
    base_url: str,
    path: str,
    identifier: str,
    request_body: bytes | None,
) -> str:
    """v0: Silo subnet signature encoding"""
    if request_body is None:
        request_body = DEFAULT_REQUEST_BODY
    raw_signature = b"v0|%s|%s|%s|%s" % (
        base_url.rstrip("/").encode("utf-8"),
        trim_leading_slashes(path).encode("utf-8"),
        identifier.encode("utf-8"),
        request_body,
    )
    signature = hmac.new(secret.encode("utf-8"), raw_signature, sha256).hexdigest()
    return f"v0={signature}"


def verify_subnet_signature(
    base_url: str,
    path: str,
    identifier: str,
    request_body: bytes | None,
    provided_signature: str,
) -> bool:
    """v0: Silo subnet signature decoding and verification"""
    secret = getattr(settings, "SENTRY_SUBNET_SECRET")
    if not secret:
        return False

    assembled_signature = encode_subnet_signature(
        secret=secret,
        base_url=base_url,
        path=path,
        identifier=identifier,
        request_body=request_body,
    )

    return hmac.compare_digest(
        assembled_signature.encode("utf-8"), provided_signature.encode("utf-8")
    )
