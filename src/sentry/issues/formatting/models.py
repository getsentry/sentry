"""The flat model the formatter renders from: ``EventObject`` plus its nested pieces. Adapted
from Seer's ``EventDetails`` but defined here in Sentry, and kept flat (issue-level fields live
on ``EventObject``) so one section list renders any issue type. Trace models omitted for now.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


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
    in_app: bool = Field(False, alias="inApp")


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
    class Config:
        allow_population_by_field_name = True

    op: str | None = None
    description: str | None = None
    exclusive_time_ms: float | None = Field(None, alias="exclusiveTime")


class UserDetails(BaseModel):
    class Config:
        allow_population_by_field_name = True

    id: str | None = None
    email: str | None = None
    username: str | None = None
    ip_address: str | None = Field(None, alias="ipAddress")


class EventObject(BaseModel):
    """Flat, event-rooted formatter model; issue-level fields are optional."""

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

    # issue-level fields (optional; filled when formatting from an issue)
    short_id: str | None = None
    culprit: str | None = None
    status: str | None = None
    level: str | None = None
    first_seen: datetime | None = None
    last_seen: datetime | None = None
    count: int | None = None
    user_count: int | None = None
    permalink: str | None = None
