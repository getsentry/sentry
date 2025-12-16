from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, ValidationError  # noqa: F401


class GitHubCheckRunAction(StrEnum):
    COMPLETED = "completed"
    CREATED = "created"
    REQUESTED_ACTION = "requested_action"
    REREQUESTED = "rerequested"


class GitHubCheckRunData(BaseModel):
    """GitHub check_run object structure."""

    external_id: str = Field(..., description="The external ID set by Seer")
    html_url: str = Field(..., description="The URL to view the check run on GitHub")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


class GitHubCheckRunEvent(BaseModel):
    """
    GitHub check_run webhook event payload.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    action: str = Field(..., description="The action performed (e.g., 'rerequested')")
    check_run: GitHubCheckRunData = Field(..., description="The check run data")

    class Config:
        extra = "allow"  # Allow additional fields from GitHub (Pydantic v1 syntax)


class GitHubRepository(BaseModel):
    """GitHub repository object structure (minimal fields for tests)."""

    id: int = Field(..., description="The repository ID")
    full_name: str | None = Field(None, description="Full name of the repository")
    html_url: str | None = Field(None, description="URL to view the repository on GitHub")

    class Config:
        extra = "allow"


class GitHubCheckRunDataOptional(BaseModel):
    """GitHub check_run object with optional fields for test validation."""

    external_id: str | None = Field(None, description="The external ID for the check run")
    html_url: str | None = Field(None, description="The URL to view the check run on GitHub")

    class Config:
        extra = "allow"


class GitHubCheckRunEventForTests(BaseModel):
    """
    Permissive GitHub check_run event model for test helpers.

    This model validates the minimal required fields (repository.id)
    while allowing missing or invalid check_run data for error test cases.
    """

    repository: GitHubRepository = Field(..., description="The repository data")
    check_run: GitHubCheckRunDataOptional | None = Field(None, description="The check run data")
    action: str | None = Field(None, description="The action performed")

    class Config:
        extra = "allow"
