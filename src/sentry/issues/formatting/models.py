"""The flat model the formatter renders from: ``EventObject`` plus its nested pieces. Kept
flat so one section list renders any issue type. Trace models omitted for now.
"""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, validator

# marks an entry that didn't survive cleaning, so it stays distinct from a real ``None`` value
_DROP = object()


def contains_filtered(value: Any) -> bool:
    """Whether a value is, or contains, a scrubbed leaf. Sentry's datascrubbers replace the value
    itself with the literal ``[Filtered]``, so the entry is left carrying nothing worth rendering.
    """
    return "[Filtered]" in str(value)


def _drop_filtered(value: Any) -> Any:
    """Strip scrubbed leaves, returning ``_DROP`` when nothing worth keeping survives.

    A legitimate ``None`` or ``0`` survives, and so does a container that arrives empty --
    ``items = []`` is often the bug itself. Only a scrubbed scalar, and a container that
    scrubbing empties out, are dropped.
    """
    if not isinstance(value, Mapping | list):
        return _DROP if contains_filtered(value) else value
    if not value:
        return value

    if isinstance(value, Mapping):
        kept_items = {k: c for k, v in value.items() if (c := _drop_filtered(v)) is not _DROP}
        return kept_items or _DROP
    kept_entries = [c for v in value if (c := _drop_filtered(v)) is not _DROP]
    return kept_entries or _DROP


class Frame(BaseModel):
    # accept the serialized camelCase keys (absPath, lineNo, ...) via aliases,
    # while still allowing snake_case construction in-code
    class Config:
        allow_population_by_field_name = True

    function: str | None = None
    filename: str | None = None
    abs_path: str | None = Field(None, alias="absPath")
    module: str | None = None
    package: str | None = None
    line_no: int | None = Field(None, alias="lineNo")
    col_no: int | None = Field(None, alias="colNo")
    context: list[tuple[int, str | None]] = []  # [(line_no, source_line), ...]
    vars: dict[str, Any] | None = None
    # nullable because the serializer emits inApp unpruned, so it can be an explicit null
    in_app: bool | None = Field(False, alias="inApp")

    # ``context`` is declared above ``vars`` so it is already validated and available here
    @validator("vars")
    def _trim_vars(
        cls, vars: dict[str, Any] | None, values: dict[str, Any]
    ) -> dict[str, Any] | None:
        """Keep only the vars the frame's source mentions, minus scrubbed values. Scrubbed
        values go even when the frame carries no source context to narrow against.
        """
        if not vars:
            return vars

        code = "\n".join(line or "" for _, line in values.get("context") or [])
        return {
            key: cleaned
            for key, value in vars.items()
            if not (code and key not in code) and (cleaned := _drop_filtered(value)) is not _DROP
        }


class Stacktrace(BaseModel):
    frames: list[Frame] = []


class ExceptionDetails(BaseModel):
    type: str | None = None
    value: str | None = None
    stacktrace: Stacktrace | None = None
    is_handled: bool | None = None


class ThreadDetails(BaseModel):
    id: int | str | None = None
    name: str | None = None
    crashed: bool | None = None
    current: bool | None = None
    state: str | None = None
    stacktrace: Stacktrace | None = None


class Breadcrumb(BaseModel):
    type: str | None = None
    category: str | None = None
    level: str | None = None
    message: str | None = None
    data: dict[str, Any] | None = None


class RequestDetails(BaseModel):
    method: str | None = None
    url: str | None = None
    data: Any | None = None
    # not including cookies, headers, env, query, etc.


class CspDetails(BaseModel):
    # serialized csp entry is already snake_case; original_policy is dropped as noise
    effective_directive: str | None = None
    blocked_uri: str | None = None
    document_uri: str | None = None


class EvidenceSpan(BaseModel):
    op: str | None = None
    description: str | None = None
    # the spans entry passes raw span keys through untouched, so this one stays snake_case
    exclusive_time: float | None = None  # duration in milliseconds


class UserDetails(BaseModel):
    class Config:
        allow_population_by_field_name = True

    id: str | None = None
    email: str | None = None
    username: str | None = None
    ip_address: str | None = Field(None, alias="ipAddress")


class EventObject(BaseModel):
    """Flat, event-rooted formatter model."""

    event_id: str | None = None
    title: str
    message: str | None = None
    platform: str | None = None
    transaction_name: str | None = None
    timestamp: datetime | None = None

    # detector-issue explanation and fix hint, set by the Seer RPC on the serialized event
    detection_context: str | None = None
    troubleshooting_hint: str | None = None

    exceptions: list[ExceptionDetails] = []
    # a bare ``stacktrace`` entry, which events without an exception can still carry
    stacktrace: Stacktrace | None = None
    threads: list[ThreadDetails] = []
    breadcrumbs: list[Breadcrumb] = []
    request: RequestDetails | None = None
    csp: CspDetails | None = None
    tags: list[tuple[str, str | None]] = []
    contexts: dict[str, dict[str, Any]] = {}
    user: UserDetails | None = None
    spans: list[EvidenceSpan] = []
    # occurrence evidence (name/value pairs) for perf & generic/regression issues
    evidence: list[tuple[str, str]] = []
    culprit: str | None = None
