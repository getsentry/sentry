from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, NotRequired, TypedDict

from sentry_sdk.types import DataCollectionUserOptions, Event, Hint, Log


class SdkConfig(TypedDict):
    release: str | None
    environment: str
    project_root: str
    in_app_include: list[str]
    debug: bool
    data_collection: DataCollectionUserOptions
    auto_enabling_integrations: bool
    keep_alive: NotRequired[bool]
    attach_stacktrace: NotRequired[bool]
    spotlight: NotRequired[str | bool | None]
    add_full_stack: NotRequired[bool]
    max_value_length: NotRequired[int]
    send_client_reports: NotRequired[bool]
    trace_lifecycle: NotRequired[Literal["static", "stream"]]
    traces_sampler: NotRequired[Callable[[dict[str, Any]], float]]
    transport_queue_size: NotRequired[int]
    before_send: NotRequired[Callable[[Event, Hint], Event | None]]
    before_send_transaction: NotRequired[Callable[[Event, Hint], Event | None]]
    before_send_log: NotRequired[Callable[[Log, Hint], Log | None]]
    profile_session_sample_rate: NotRequired[float]
    profile_lifecycle: NotRequired[Literal["manual", "trace"]]
    enable_db_query_source: NotRequired[bool]
    enable_http_request_source: NotRequired[bool]
    db_query_source_threshold_ms: NotRequired[int]
    _experiments: NotRequired[Any]  # TODO


class ServerSdkConfig(SdkConfig):
    # these get popped before sending along to the sdk
    backend_dsn: NotRequired[str]
