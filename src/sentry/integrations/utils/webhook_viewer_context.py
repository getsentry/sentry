from __future__ import annotations

import contextlib
from collections.abc import Generator

from sentry import options
from sentry.viewer_context import ActorType, ViewerContext, viewer_context_scope


@contextlib.contextmanager
def webhook_viewer_context(organization_id: int) -> Generator[None]:
    """Set ViewerContext for a webhook handler processing an org-scoped event.

    Gated by the ``viewer-context.enabled`` option so it rolls out alongside
    the rest of the ViewerContext infrastructure.
    """
    if not options.get("viewer-context.enabled"):
        yield
        return

    with viewer_context_scope(
        ViewerContext(
            organization_id=organization_id,
            actor_type=ActorType.INTEGRATION,
        )
    ):
        yield
