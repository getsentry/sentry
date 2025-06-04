from typing import Any, TypedDict


class SentryEventData(TypedDict):
    tag: str
    payload: dict[str, Any]


class SentryEvent(TypedDict):
    data: SentryEventData
    timestamp: int
    type: int
