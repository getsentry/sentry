from __future__ import annotations

from typing import Any, TypedDict


class ObjectstoreUploadOptions(TypedDict):
    url: str
    scopes: dict[str, Any]
    # TODO: add authToken
    expirationPolicy: str
