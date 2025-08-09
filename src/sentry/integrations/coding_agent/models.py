from datetime import datetime

from pydantic import BaseModel

from sentry.seer.models import SeerRepoDefinition


class CodingAgentLaunchRequest(BaseModel):
    prompt: str
    repository: SeerRepoDefinition
    branch_name: str | None = None


class CodingAgentSource(BaseModel):
    repository: str
    ref: str


class CodingAgentTarget(BaseModel):
    autoCreatePr: bool
    branchName: str
    url: str


class CodingAgentLaunchResponse(BaseModel):
    id: str
    status: str
    source: CodingAgentSource
    target: CodingAgentTarget
    name: str
    createdAt: datetime
