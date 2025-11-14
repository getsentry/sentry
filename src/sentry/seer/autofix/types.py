from __future__ import annotations

from typing import Any, TypedDict, int


class AutofixPostResponse(TypedDict):
    """Response type for the POST endpoint"""

    run_id: int


class AutofixStateResponse(TypedDict):
    """Response type for the GET endpoint"""

    autofix: dict[str, Any] | None
