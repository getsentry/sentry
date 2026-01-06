from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class GithubCopilotPRConfig(BaseModel):
    title: str | None = None
    body_placeholder: str | None = None
    body_suffix: str | None = None
    base_ref: str | None = None
    head_ref: str | None = None
    labels: list[str] | None = None


class GithubCopilotJobRequest(BaseModel):
    problem_statement: str
    content_filter_mode: str = "hidden_characters"
    pull_request: GithubCopilotPRConfig | None = None
    run_name: str | None = None
    event_type: str = "sentry"
    event_url: str | None = None
    event_identifiers: list[str] | None = None


class GithubCopilotActor(BaseModel):
    id: str
    login: str


class GithubCopilotJobResponse(BaseModel):
    job_id: str
    session_id: str
    actor: GithubCopilotActor
    created_at: datetime
    updated_at: datetime
