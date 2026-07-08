"""Adapter: serialized event dict -> flat ``EventObject``.

The serialized event (Sentry's ``EventSerializer`` output) is camelCase and nested: data
lives under ``entries[]`` keyed by ``type``, frames use ``lineNo``/``inApp``/``absPath``,
and the handled flag is ``mechanism.handled``. This module does the explicit structural
mapping into our snake_case models.

It is a pure structural mapping: no truncation or filtering (last-N breadcrumbs, max frames,
skip ``[Filtered]``) happens here. Those are limit concerns handled by the sections + limits
layer, so the model carries the full data and rendering decides what to cap.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from sentry.issues.formatting.models import (
    Breadcrumb,
    EventObject,
    EvidenceSpan,
    ExceptionDetails,
    Frame,
    RequestDetails,
    Stacktrace,
    ThreadDetails,
    UserDetails,
)


def _entries_by_type(data: Mapping[str, Any]) -> dict[str, Any]:
    """Map each entry's ``type`` to its ``data``. Later entries of a type win (rare)."""
    result: dict[str, Any] = {}
    for entry in data.get("entries", []) or []:
        if isinstance(entry, Mapping) and "type" in entry:
            result[entry["type"]] = entry.get("data")
    return result


def _frame(f: Mapping[str, Any]) -> Frame:
    return Frame(
        function=f.get("function"),
        filename=f.get("filename"),
        abs_path=f.get("absPath"),
        module=f.get("module"),
        package=f.get("package"),
        line_no=f.get("lineNo"),
        col_no=f.get("colNo"),
        context=f.get("context") or [],
        vars=f.get("vars"),
        in_app=bool(f.get("inApp")),
    )


def _stacktrace(st: Any) -> Stacktrace | None:
    if not isinstance(st, Mapping):
        return None
    frames = [_frame(f) for f in st.get("frames", []) or [] if isinstance(f, Mapping)]
    return Stacktrace(frames=frames)


def _exception(v: Mapping[str, Any]) -> ExceptionDetails:
    mechanism = v.get("mechanism") or {}
    handled = mechanism.get("handled") if isinstance(mechanism, Mapping) else None
    return ExceptionDetails(
        type=v.get("type"),
        value=v.get("value"),
        stacktrace=_stacktrace(v.get("stacktrace")),
        is_handled=handled,
    )


def _thread(v: Mapping[str, Any]) -> ThreadDetails:
    return ThreadDetails(
        id=v.get("id"),
        name=v.get("name"),
        crashed=v.get("crashed"),
        current=v.get("current"),
        state=v.get("state"),
        stacktrace=_stacktrace(v.get("stacktrace")),
    )


def _breadcrumb(v: Mapping[str, Any]) -> Breadcrumb:
    return Breadcrumb(
        type=v.get("type"),
        category=v.get("category"),
        level=v.get("level"),
        message=v.get("message"),
        data=v.get("data"),
        timestamp=v.get("timestamp"),
    )


def _request(d: Any) -> RequestDetails | None:
    if not isinstance(d, Mapping):
        return None
    return RequestDetails(method=d.get("method"), url=d.get("url"), data=d.get("data"))


def _spans(d: Any) -> list[EvidenceSpan]:
    if not isinstance(d, Sequence) or isinstance(d, str | bytes):
        return []
    return [
        EvidenceSpan(
            op=s.get("op"),
            description=s.get("description"),
            exclusive_time_ms=s.get("exclusiveTime"),
        )
        for s in d
        if isinstance(s, Mapping)
    ]


def _user(d: Any) -> UserDetails | None:
    if not isinstance(d, Mapping):
        return None
    return UserDetails(
        id=d.get("id"),
        email=d.get("email"),
        username=d.get("username"),
        ip_address=d.get("ipAddress"),
    )


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

    exceptions = [
        _exception(v)
        for v in (entries.get("exception") or {}).get("values", []) or []
        if isinstance(v, Mapping)
    ]
    threads = [
        _thread(v)
        for v in (entries.get("threads") or {}).get("values", []) or []
        if isinstance(v, Mapping)
    ]
    breadcrumbs = [
        _breadcrumb(v)
        for v in (entries.get("breadcrumbs") or {}).get("values", []) or []
        if isinstance(v, Mapping)
    ]

    message_entry = entries.get("message") or {}
    message = message_entry.get("formatted") if isinstance(message_entry, Mapping) else None

    tags, transaction_name = _tags(data)

    return EventObject(
        event_id=data.get("eventID") or data.get("id"),
        title=data.get("title") or "",
        message=message,
        platform=data.get("platform"),
        transaction_name=transaction_name,
        timestamp=data.get("dateCreated") or data.get("dateReceived"),
        exceptions=exceptions,
        threads=threads,
        breadcrumbs=breadcrumbs,
        request=_request(entries.get("request")),
        tags=tags,
        contexts=data.get("contexts") or {},
        user=_user(data.get("user")),
        spans=_spans(entries.get("spans")),
    )
