"""Maps a serialized event (camelCase, nested under ``entries[]``) into the flat ``EventObject``.

Fields whose serialized keys match the model (directly or via alias) are parsed with
``.parse_obj``. The helpers below cover the cases that need real work: nested extraction,
the raw/processed stacktrace fallback, and reshaping tags.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.issues.formatting.models import (
    Breadcrumb,
    EventObject,
    EvidenceSpan,
    ExceptionDetails,
    RequestDetails,
    Stacktrace,
    ThreadDetails,
    UserDetails,
)


def _entries_by_type(data: Mapping[str, Any]) -> dict[str, Any]:
    return {entry["type"]: entry.get("data") for entry in data.get("entries") or []}


def _values(entry_data: Any) -> list[Any]:
    return (entry_data or {}).get("values") or []


def _best_stacktrace(v: Mapping[str, Any]) -> Stacktrace | None:
    # prefer the processed stacktrace; fall back to rawStacktrace when that's where the frames are
    for key in ("stacktrace", "rawStacktrace"):
        st = v.get(key)
        if st:
            parsed = Stacktrace.parse_obj(st)
            if parsed.frames:
                return parsed
    return None


def _exception(v: Mapping[str, Any]) -> ExceptionDetails:
    return ExceptionDetails(
        type=v.get("type"),
        value=v.get("value"),
        stacktrace=_best_stacktrace(v),
        is_handled=(v.get("mechanism") or {}).get("handled"),  # nested under mechanism
    )


def _thread(v: Mapping[str, Any]) -> ThreadDetails:
    thread = ThreadDetails.parse_obj(v)
    thread.stacktrace = _best_stacktrace(v)  # same raw/processed fallback as exceptions
    return thread


def _tags(data: Mapping[str, Any]) -> tuple[list[tuple[str, str | None]], str | None]:
    tags = [(tag["key"], tag.get("value")) for tag in data.get("tags") or []]
    transaction_name = next((value for key, value in tags if key == "transaction"), None)
    return tags, transaction_name


def event_response_to_model(data: Mapping[str, Any]) -> EventObject:
    entries = _entries_by_type(data)
    tags, transaction_name = _tags(data)

    # message entry's formatted text, then its raw message, then the top-level message
    message_entry = entries.get("message") or {}
    message = message_entry.get("formatted") or message_entry.get("message") or data.get("message")

    request = entries.get("request")
    user = data.get("user")

    return EventObject(
        event_id=data.get("eventID"),
        title=data["title"],
        message=message,
        culprit=data.get("culprit"),
        platform=data.get("platform"),
        transaction_name=transaction_name,
        timestamp=data.get("dateCreated") or data.get("dateReceived"),
        exceptions=[_exception(v) for v in _values(entries.get("exception"))],
        threads=[_thread(v) for v in _values(entries.get("threads"))],
        breadcrumbs=[Breadcrumb.parse_obj(v) for v in _values(entries.get("breadcrumbs"))],
        request=RequestDetails.parse_obj(request) if request else None,
        tags=tags,
        contexts=data.get("contexts") or {},
        user=UserDetails.parse_obj(user) if user else None,
        spans=[EvidenceSpan.parse_obj(s) for s in entries.get("spans") or []],
    )
