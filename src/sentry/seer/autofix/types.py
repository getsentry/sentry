from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict, Union

from pydantic import BaseModel, Field

from sentry.issues.formatting.formatter import FormattedResponse


class GithubAppPermissionsWarning(BaseModel):
    """The GitHub App installation backing a touched repo is missing permissions
    Seer needs; the user should re-accept them."""

    warning_type: Literal["github_app_permissions"] = "github_app_permissions"
    repo_name: str
    installation_id: str


# Discriminated on `warning_type`; add new warning models to this union.
AutofixWarning = Annotated[
    Union[GithubAppPermissionsWarning],
    Field(discriminator="warning_type"),
]


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint (default kickoff and step paths)."""

    run_id: int
    # None for legacy runs predating SeerRun mirroring, which have no mirror row.
    sentry_run_id: str | None


class AutofixHandoffResponse(TypedDict):
    """Response type for the POST endpoint when `step=coding_agent_handoff`."""

    successes: list[dict[str, Any]]
    failures: list[dict[str, Any]]


class _AutofixStateResponseOptional(TypedDict, total=False):
    # present only when ``?llmFormat`` is requested and the formatter feature is on.
    # total=False rather than NotRequired: this module uses `from __future__ import annotations`,
    # so NotRequired arrives as a string, TypedDict marks the key required, and the openapi
    # schema then fails the api-docs example validator.
    formatted: FormattedResponse


class AutofixStateResponse(_AutofixStateResponseOptional):
    """Response type for the GET endpoint"""

    # can't fold into one `total=False` class the way GroupEventDetailsFormattedResponse does:
    # `autofix` is declared here, so it would go optional too
    autofix: dict[str, Any] | None
