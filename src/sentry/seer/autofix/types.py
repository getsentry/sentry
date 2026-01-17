from __future__ import annotations

from typing import Any, Literal, NotRequired, TypedDict


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint"""

    run_id: int


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: dict[str, Any] | None


class AutofixSelectRootCausePayload(TypedDict):
    type: Literal["select_root_cause"]
    cause_id: int
    stopping_point: NotRequired[Literal["solution", "code_changes", "open_pr"]]


class AutofixSelectSolutionPayload(TypedDict):
    type: Literal["select_solution"]


class AutofixCreatePRPayload(TypedDict):
    type: Literal["create_pr"]


class AutofixUpdateRequest(TypedDict):
    run_id: int
    payload: AutofixSelectRootCausePayload | AutofixSelectSolutionPayload | AutofixCreatePRPayload
