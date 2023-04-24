from __future__ import annotations

import hmac
import re
from hashlib import sha256
from typing import List, Mapping

from django.conf import settings

PROXY_OI_HEADER = "X-Sentry-Subnet-Organization-Integration"
PROXY_SIGNATURE_HEADER = "X-Sentry-Subnet-Signature"
PROXY_TIMESTAMP_HEADER = "X-Sentry-Subnet-Timestamp"

INVALID_PROXY_HEADERS = ["Host", "Content-Length"]
INVALID_OUTBOUND_HEADERS = INVALID_PROXY_HEADERS + [
    PROXY_OI_HEADER,
    PROXY_SIGNATURE_HEADER,
    PROXY_TIMESTAMP_HEADER,
]


def trim_leading_slashes(path: str) -> str:
    result = re.search(r"^\/+(\S+)", path)
    if result is not None:
        return result.groups()[0]
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
    timestamp: str,
    path: str,
    identifier: str,
    request_body: str | bytes,
) -> str:
    """v0: Silo subnet signature encoding"""
    raw_signature = b"v0|%s|%s|%s|%s" % (
        timestamp.encode("utf-8"),
        trim_leading_slashes(path).encode("utf-8"),
        identifier.encode("utf-8"),
        request_body,
    )  # type: ignore
    signature = hmac.new(secret.encode("utf-8"), raw_signature, sha256).hexdigest()
    return f"v0={signature}"


def verify_subnet_signature(
    timestamp: str,
    path: str,
    identifier: str,
    request_body: bytes,
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
