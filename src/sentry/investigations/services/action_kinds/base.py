from __future__ import annotations

import abc

from sentry.investigations.contracts import ActionPayloadSerializer


class ActionKind(abc.ABC):
    """Everything Sentry needs to check, apply, and record one kind of action."""

    kind: str
    payload_serializer: type[ActionPayloadSerializer]
