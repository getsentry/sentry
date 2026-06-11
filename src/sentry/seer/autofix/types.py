from __future__ import annotations

from typing import Any, TypedDict


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint (default kickoff and step paths)."""

    run_id: int


class AutofixHandoffResponse(TypedDict):
    """Response type for the POST endpoint when `step=coding_agent_handoff`."""

    successes: list[dict[str, Any]]
    failures: list[dict[str, Any]]


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: dict[str, Any] | None
