from __future__ import annotations

import contextlib
from collections.abc import Generator

from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope


@contextlib.contextmanager
def webhook_viewer_context(organization_id: int) -> Generator[None]:
    """Set ViewerContext for a webhook handler processing an org-scoped event."""
    with viewer_context_scope(
        ViewerContext(actor=Actor(type=ActorType.INTEGRATION), organization_id=organization_id)
    ):
        yield
