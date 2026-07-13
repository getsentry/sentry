"""Maps a serialized event (camelCase, nested under ``entries[]``) into the snake_case
``EventObject``. Pure structural mapping; truncation and filtering are left to the sections.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
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

# Models whose fields all match the serialized keys (single-word, or aliased for camelCase)
# are parsed directly with ``.parse_obj``. The helpers below only exist where the serialized
# shape needs real work: nested extraction, fallbacks, or structural reshaping.


def _entries_by_type(data: Mapping[str, Any]) -> dict[str, Any]:
    """Map each entry's ``type`` to its ``data``. Later entries of a type win (rare)."""
    result: dict[str, Any] = {}
    for entry in data.get("entries", []) or []:
        if isinstance(entry, Mapping) and "type" in entry:
            result[entry["type"]] = entry.get("data")
    return result


def _best_stacktrace(v: Mapping[str, Any]) -> Stacktrace | None:
    # prefer the processed stacktrace; fall back to rawStacktrace when it has the frames
    for key in ("stacktrace", "rawStacktrace"):
        st = v.get(key)
        if isinstance(st, Mapping):
            parsed = Stacktrace.parse_obj(st)
            if parsed.frames:
                return parsed
    return None


def _exception(v: Mapping[str, Any]) -> ExceptionDetails:
    # is_handled is nested under mechanism, and the stacktrace needs the raw/processed fallback
    mechanism = v.get("mechanism") or {}
    handled = mechanism.get("handled") if isinstance(mechanism, Mapping) else None
    return ExceptionDetails(
        type=v.get("type"),
        value=v.get("value"),
        stacktrace=_best_stacktrace(v),
        is_handled=handled,
    )


def _thread(v: Mapping[str, Any]) -> ThreadDetails:
    # threads carry a stacktrace that needs the same raw/processed fallback
    thread = ThreadDetails.parse_obj(v)
    thread.stacktrace = _best_stacktrace(v)
    return thread


def _spans(d: Any) -> list[EvidenceSpan]:
    # the spans entry's data is a bare list, not the usual {"values": [...]}
    if not isinstance(d, Sequence) or isinstance(d, str | bytes):
        return []
    return [EvidenceSpan.parse_obj(s) for s in d if isinstance(s, Mapping)]


def _values(entry_data: Any) -> list[Mapping[str, Any]]:
    """The ``values`` list from an entry's data, keeping only well-formed mappings."""
    if not isinstance(entry_data, Mapping):
        return []
    return [v for v in entry_data.get("values") or [] if isinstance(v, Mapping)]


def _tags(data: Mapping[str, Any]) -> tuple[list[tuple[str, str | None]], str | None]:
    tags: list[tuple[str, str | None]] = []
    transaction_name: str | None = None
    for tag in data.get("tags", []) or []:
        if not isinstance(tag, Mapping):
            continue
        key, value = tag.get("key"), tag.get("value")
        if key is None:
            continue
        tags.append((key, value))
        if key == "transaction":
            transaction_name = value
    return tags, transaction_name


def event_response_to_model(data: Mapping[str, Any]) -> EventObject:
    """Map a serialized event response into an ``EventObject``."""
    entries = _entries_by_type(data)
    tags, transaction_name = _tags(data)

    # prefer the message entry's formatted text, then its raw message, then the top-level message
    message_entry = entries.get("message")
    message = (
        message_entry.get("formatted") or message_entry.get("message")
        if isinstance(message_entry, Mapping)
        else None
    ) or data.get("message")

    request = entries.get("request")
    user = data.get("user")

    return EventObject(
        event_id=data.get("eventID") or data.get("id"),
        title=data.get("title") or "",
        message=message,
        culprit=data.get("culprit"),
        platform=data.get("platform"),
        transaction_name=transaction_name,
        timestamp=data.get("dateCreated") or data.get("dateReceived"),
        exceptions=[_exception(v) for v in _values(entries.get("exception"))],
        threads=[_thread(v) for v in _values(entries.get("threads"))],
        breadcrumbs=[Breadcrumb.parse_obj(v) for v in _values(entries.get("breadcrumbs"))],
        request=RequestDetails.parse_obj(request) if isinstance(request, Mapping) else None,
        tags=tags,
        contexts=data.get("contexts") or {},
        user=UserDetails.parse_obj(user) if isinstance(user, Mapping) else None,
        spans=_spans(entries.get("spans")),
    )
