from typing import Dict, Literal, TypedDict

from typing_extensions import NotRequired


class CheckinMessage(TypedDict):
    # TODO(epurkhiser): We should make this required and ensure the message
    # produced by relay includes this message type
    message_type: NotRequired[Literal["check_in"]]
    payload: str
    start_time: float
    project_id: str
    sdk: str


class ClockPulseMessage(TypedDict):
    message_type: Literal["clock_pulse"]


class CheckinTrace(TypedDict):
    trace_id: str


class CheckinContexts(TypedDict):
    trace: NotRequired[CheckinTrace]


class CheckinPayload(TypedDict):
    check_in_id: str
    monitor_slug: str
    status: str
    environment: NotRequired[str]
    duration: NotRequired[int]
    monitor_config: NotRequired[Dict]
    contexts: NotRequired[CheckinContexts]
