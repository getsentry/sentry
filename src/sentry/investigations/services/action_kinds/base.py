from __future__ import annotations

import abc

from sentry.investigations.contracts import ActionPayloadSerializer


class ActionKind(abc.ABC):
    """How Sentry checks, applies, and records one kind of action."""

    kind: str
    payload_serializer: type[ActionPayloadSerializer]
