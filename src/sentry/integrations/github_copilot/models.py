from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GithubCopilotTaskRequest(BaseModel):
    problem_statement: str
    event_content: str | None = None
    model: str | None = None
    create_pull_request: bool = True
    base_ref: str | None = None
    event_type: str = "sentry"


class GithubCopilotTask(BaseModel):
    id: str
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class GithubCopilotTaskCreateResponse(BaseModel):
    task: GithubCopilotTask


class GithubCopilotArtifactData(BaseModel):
    id: int
    type: str
    global_id: str


class GithubCopilotArtifact(BaseModel):
    provider: str
    type: str
    data: GithubCopilotArtifactData


class GithubCopilotTaskStatusResponse(BaseModel):
    id: str
    status: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    artifacts: list[GithubCopilotArtifact] | None = None


class GithubPRFromGraphQL(BaseModel):
    number: int
    title: str
    url: str
