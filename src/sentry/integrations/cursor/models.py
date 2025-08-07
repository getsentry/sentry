from datetime import datetime

from pydantic import BaseModel


class CursorAgentSource(BaseModel):
    repository: str
    ref: str


class CursorAgentTarget(BaseModel):
    autoCreatePr: bool
    branchName: str
    url: str


class CursorAgentLaunchResponse(BaseModel):
    id: str
    status: str
    source: CursorAgentSource
    target: CursorAgentTarget
    name: str
    createdAt: datetime
