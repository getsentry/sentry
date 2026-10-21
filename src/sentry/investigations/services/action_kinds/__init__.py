from __future__ import annotations

from sentry.investigations.services.action_kinds.base import ActionKind
from sentry.investigations.services.action_kinds.connect_telemetry import ConnectTelemetryKind
from sentry.investigations.services.action_kinds.update_detector import UpdateDetectorKind

ACTION_KINDS: dict[str, ActionKind] = {
    kind.kind: kind for kind in (UpdateDetectorKind(), ConnectTelemetryKind())
}


def get_action_kind(kind: str | None) -> ActionKind | None:
    return ACTION_KINDS.get(kind) if kind is not None else None
