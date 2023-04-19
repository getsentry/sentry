from __future__ import annotations

from typing import Any, Mapping

INVALID_PROXY_HEADERS = ["Host"]


def clean_proxy_headers(headers: Mapping[str, Any] | None) -> Mapping[str, Any]:
    if not headers:
        headers = {}
    modified_headers = {**headers}
    for invalid_header in INVALID_PROXY_HEADERS:
        modified_headers.pop(invalid_header, None)
    return modified_headers
