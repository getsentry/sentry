from typing import Any, Dict, TypedDict


class SentryEventData(TypedDict):
    tag: str
    payload: Dict[str, Any]


class SentryEvent(TypedDict):
    data: SentryEventData
    timestamp: int
    type: int
