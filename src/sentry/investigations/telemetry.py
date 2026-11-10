from __future__ import annotations

from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.notebooks.telemetry import investigation_attributes, record_count


def _action_request_attributes(action_request: NotebookActionRequest) -> dict[str, str]:
    attributes = {"kind": action_request.action_kind or "advice"}
    provider = (action_request.action_payload or {}).get("provider")
    if provider:
        attributes["provider"] = str(provider)
    return attributes


def record_action_request_suggested(action_request: NotebookActionRequest) -> None:
    record_count(
        "investigations.action_request.suggested", _action_request_attributes(action_request)
    )


def record_action_request_applied(action_request: NotebookActionRequest) -> None:
    record_count(
        "investigations.action_request.applied", _action_request_attributes(action_request)
    )


def record_investigation_started(investigation: Notebook) -> None:
    record_count("investigations.started", investigation_attributes(investigation))
