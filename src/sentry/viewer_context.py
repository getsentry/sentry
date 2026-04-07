from __future__ import annotations

import contextlib
import contextvars
import dataclasses
import enum
from collections.abc import Generator
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.auth.services.auth import AuthenticatedToken

_viewer_context_var: contextvars.ContextVar[ViewerContext | None] = contextvars.ContextVar(
    "viewer_context", default=None
)

"""
ViewerContext is an object propagated across codebase (and crossing service boundary) to deliver
accurate information regarding the viewer on behalf of which the request is being made.

This can be global, limited to an organization, or particular user.

The proposal for this project alongside needs and specific considerations can be found in:
https://www.notion.so/sentry/RFC-Unified-ViewerContext-via-ContextVar-32f8b10e4b5d81988625cb5787035e02
"""


class ActorType(enum.StrEnum):
    USER = "user"
    SYSTEM = "system"
    INTEGRATION = "integration"
    UNKNOWN = "unknown"


@dataclasses.dataclass(frozen=True)
class ViewerContext:
    """Identity of the caller for the current unit of work.

    Set once at each entrypoint (API request, task, consumer, RPC) via
    ``viewer_context_scope`` and readable anywhere via ``get_viewer_context``.

    Frozen so that ``copy_context()`` produces a safe shallow copy when
    propagating across threads.
    """

    organization_id: int | None = None
    user_id: int | None = None
    actor_type: ActorType = ActorType.UNKNOWN

    # Carries scopes/kind for in-process permission checks.
    # NOT propagated across process/service boundaries.
    token: AuthenticatedToken | None = None

    def serialize(self) -> dict[str, Any]:
        """Serialize to a dict for cross-service headers (e.g. X-Viewer-Context)."""
        result: dict[str, Any] = {"actor_type": self.actor_type.value}
        if self.organization_id is not None:
            result["organization_id"] = self.organization_id
        if self.user_id is not None:
            result["user_id"] = self.user_id
        if self.token is not None:
            result["token"] = {"kind": self.token.kind, "scopes": list(self.token.get_scopes())}
        return result


@contextlib.contextmanager
def viewer_context_scope(ctx: ViewerContext) -> Generator[None]:
    """Enter a viewer context for the duration of a unit of work.

    Always use this instead of raw ``_viewer_context_var.set()`` —
    it guarantees cleanup via ``reset(token)`` even on exceptions.
    """
    tok = _viewer_context_var.set(ctx)
    try:
        yield
    finally:
        _viewer_context_var.reset(tok)


def get_viewer_context() -> ViewerContext | None:
    """Return the current ``ViewerContext``, or ``None`` if not set."""
    return _viewer_context_var.get()
