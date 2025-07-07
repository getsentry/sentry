from typing import Literal, TypedDict

ReplayActionsEventPayloadClick = TypedDict(
    "ReplayActionsEventPayloadClick",
    {
        "alt": str,
        "aria_label": str,
        "class": list[str],
        "event_hash": str,
        "id": str,
        "node_id": int,
        "component_name": str,
        "role": str,
        "tag": str,
        "testid": str,
        "text": str,
        "timestamp": int,
        "title": str,
        "is_dead": int,
        "is_rage": int,
    },
)


class ReplayActionsEventPayload(TypedDict):
    environment: str
    clicks: list[ReplayActionsEventPayloadClick]
    replay_id: str
    type: Literal["replay_actions"]


class ReplayActionsEvent(TypedDict):
    payload: list[int]
    project_id: int
    replay_id: str
    retention_days: int
    start_time: float
    type: Literal["replay_event"]
