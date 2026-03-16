from __future__ import annotations

from typing import TypedDict


class ObjectstoreUploadOptions(TypedDict):
    url: str
    scopes: list[tuple[str, str]]
    # TODO: add authToken
    expirationPolicy: str
