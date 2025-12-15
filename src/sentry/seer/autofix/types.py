from __future__ import annotations

from typing import Any, Literal, TypedDict


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint"""

    run_id: int


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: dict[str, Any] | None


class AutofixUpdateUserMessageRequestPayload(TypedDict):
    type: Literal["user_message"]
    text: str


class AutofixUpdateRequest(TypedDict):
    run_id: int
    payload: AutofixUpdateUserMessageRequestPayload
