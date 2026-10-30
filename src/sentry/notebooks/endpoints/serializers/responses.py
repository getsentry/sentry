from datetime import datetime
from typing import TypedDict


class InvestigationViewerResponse(TypedDict):
    userId: str
    lastSeen: datetime
    active: bool


class InvestigationPresenceResponse(TypedDict):
    viewers: list[InvestigationViewerResponse]
    total: int
    heartbeatIntervalMs: int
