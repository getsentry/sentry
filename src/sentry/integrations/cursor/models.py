from datetime import datetime

from pydantic import BaseModel


class CursorApiKeyMetadata(BaseModel):
    apiKeyName: str
    createdAt: str
    userEmail: str


class CursorAgentLaunchRequestPrompt(BaseModel):
    text: str
    images: list[dict] = []


class CursorAgentSource(BaseModel):
    repository: str
    ref: str | None = None


class CursorAgentLaunchRequestWebhook(BaseModel):
    url: str
    secret: str | None = None


class CursorAgentLaunchRequestTarget(BaseModel):
    autoCreatePr: bool
    branchName: str
    openAsCursorGithubApp: bool | None = None


class CursorAgentLaunchRequestBody(BaseModel):
    prompt: CursorAgentLaunchRequestPrompt
    source: CursorAgentSource
    model: str | None = None
    target: CursorAgentLaunchRequestTarget | None = None
    webhook: CursorAgentLaunchRequestWebhook | None = None


class CursorAgentResponseTarget(BaseModel):
    autoCreatePr: bool
    branchName: str
    url: str


class CursorAgentLaunchResponse(BaseModel):
    id: str
    status: str
    source: CursorAgentSource
    target: CursorAgentResponseTarget
    name: str | None = None
    createdAt: datetime
