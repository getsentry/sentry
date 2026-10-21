from __future__ import annotations

from sentry.investigations.services.action_kinds.base import ActionKind

ACTION_KINDS: dict[str, ActionKind] = {}


def get_action_kind(kind: str | None) -> ActionKind | None:
    return ACTION_KINDS.get(kind) if kind is not None else None
