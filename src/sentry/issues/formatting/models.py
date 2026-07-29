"""The flat model the formatter renders from: ``EventObject`` plus its nested pieces. Adapted
from Seer's ``EventDetails`` but defined here in Sentry, and kept flat so one section list
renders any issue type. Trace models omitted for now.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, validator


def _drop_filtered(value: Any) -> Any:
    """Strip scrubbed leaves from a dict or list. ``None`` means nothing survived, so only call
    this on containers: a scalar ``None`` is a legitimate value, not an empty result.
    """
    if isinstance(value, dict):
        kept_items = {
            k: v for k, v in ((k, _drop_filtered(v)) for k, v in value.items()) if v is not None
        }
        return kept_items or None
    if isinstance(value, list):
        kept_entries = [v for v in (_drop_filtered(item) for item in value) if v is not None]
        return kept_entries or None
    return None if "[Filtered]" in str(value) else value


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
        """Keep only the vars the frame's source mentions, minus scrubbed values (mirrors Seer's
        ``StacktraceFrame._trim_vars``, except scrubbed values go even without source context).
        """
        if not vars:
            return vars

        code = "\n".join(line or "" for _, line in values.get("context") or [])
        kept: dict[str, Any] = {}
        for key, value in vars.items():
            if code and key not in code:
                continue
            if isinstance(value, dict | list):
                cleaned = _drop_filtered(value)
                if cleaned is not None:  # a container left empty by scrubbing carries nothing
                    kept[key] = cleaned
            elif "[Filtered]" not in str(value):
                kept[key] = value  # a scalar None or 0 is worth keeping; often it's the cause
        return kept


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

    exceptions: list[ExceptionDetails] = []
    threads: list[ThreadDetails] = []
    breadcrumbs: list[Breadcrumb] = []
    request: RequestDetails | None = None
    tags: list[tuple[str, str | None]] = []
    contexts: dict[str, dict[str, Any]] = {}
    user: UserDetails | None = None
    spans: list[EvidenceSpan] = []
    culprit: str | None = None
