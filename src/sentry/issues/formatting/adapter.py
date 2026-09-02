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
    CspDetails,
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
    # built field by field rather than parsed: .parse_obj would validate the whole frame tree
    # under "stacktrace" only for _best_stacktrace to discard it and parse it again
    return ThreadDetails(
        id=v.get("id"),
        name=v.get("name"),
        crashed=v.get("crashed"),
        current=v.get("current"),
        state=v.get("state"),
        stacktrace=_best_stacktrace(v),  # same raw/processed fallback as exceptions
    )


def _tags(data: Mapping[str, Any]) -> tuple[list[tuple[str, str | None]], str | None]:
    # skips tags with None keys
    tags = [
        (key, tag.get("value"))
        for tag in data.get("tags") or []
        if (key := tag.get("key")) is not None
    ]
    transaction_name = next((value for key, value in tags if key == "transaction"), None)
    return tags, transaction_name


# Feedback issues carry the reporter's contact details in two places: occurrence.evidenceDisplay
# and contexts.feedback (see feedback.usecases.ingest). They are user identifiers like the ones
# user_section holds back, so they follow the same rule and stay out of the default output. The
# free-form `message` is the issue's own content, not an identifier, so it stays.
_REPORTER_IDENTIFIER_KEYS = frozenset({"contact_email", "name"})


def _contexts(data: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    # a context key can hold a null or a scalar; those carry nothing to render and would fail
    # EventObject's dict[str, dict] validation, which takes the whole render down, not just
    # this section -- the adapter runs before any section does
    contexts = {
        key: value for key, value in (data.get("contexts") or {}).items() if isinstance(value, dict)
    }
    # scoped to the feedback context on purpose: `name` is a legitimate key on browser, os
    # and runtime contexts, so a blanket filter would drop real data
    if "feedback" in contexts:
        contexts["feedback"] = {
            key: value
            for key, value in contexts["feedback"].items()
            if key not in _REPORTER_IDENTIFIER_KEYS
        }
    return contexts


def _evidence(data: Mapping[str, Any]) -> list[tuple[str, str]]:
    # occurrence.evidenceDisplay carries the human-readable name/value summary for
    # perf and generic/regression issues (e.g. "Regression": "... increased ...")
    display = (data.get("occurrence") or {}).get("evidenceDisplay") or []
    return [
        (item["name"], item["value"])
        for item in display
        if item.get("name") and item.get("value") and item["name"] not in _REPORTER_IDENTIFIER_KEYS
    ]


def event_response_to_model(data: Mapping[str, Any]) -> EventObject:
    entries = _entries_by_type(data)
    tags, transaction_name = _tags(data)

    # message entry's formatted text, then its raw message, then the top-level message
    message_entry = entries.get("message") or {}
    message = message_entry.get("formatted") or message_entry.get("message") or data.get("message")

    request = entries.get("request")
    # a top-level stacktrace entry, distinct from the one nested on an exception
    stacktrace = entries.get("stacktrace")
    csp = entries.get("csp")
    user = data.get("user")

    return EventObject(
        event_id=data.get("eventID"),
        title=data["title"],
        message=message,
        culprit=data.get("culprit"),
        platform=data.get("platform"),
        transaction_name=transaction_name,
        timestamp=data.get("dateCreated") or data.get("dateReceived"),
        detection_context=data.get("detectionContext"),
        troubleshooting_hint=data.get("troubleshootingHint"),
        exceptions=[_exception(v) for v in _values(entries.get("exception"))],
        stacktrace=Stacktrace.parse_obj(stacktrace) if stacktrace else None,
        threads=[_thread(v) for v in _values(entries.get("threads"))],
        breadcrumbs=[Breadcrumb.parse_obj(v) for v in _values(entries.get("breadcrumbs"))],
        request=RequestDetails.parse_obj(request) if request else None,
        csp=CspDetails.parse_obj(csp) if csp else None,
        tags=tags,
        contexts=_contexts(data),
        user=UserDetails.parse_obj(user) if user else None,
        spans=[EvidenceSpan.parse_obj(s) for s in entries.get("spans") or []],
        evidence=_evidence(data),
    )
