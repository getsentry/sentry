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
