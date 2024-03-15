from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Literal, NotRequired, TypedDict

if TYPE_CHECKING:
    from sentry_sdk._types import Event


class SdkConfig(TypedDict):
    release: str | None
    environment: str
    project_root: str
    in_app_include: list[str]
    debug: bool
    send_default_pii: bool
    auto_enabling_integrations: bool

    send_client_reports: NotRequired[bool]
    traces_sampler: NotRequired[Callable[[dict[str, Any]], float]]
    before_send: NotRequired[Callable[[Event, object], Event | None]]
    before_send_transaction: NotRequired[Callable[[Event, object], Event | None]]
    profiles_sample_rate: NotRequired[float]
    profiler_mode: NotRequired[Literal["sleep", "thread", "gevent", "unknown"]]
    enable_db_query_source: NotRequired[bool]
    db_query_source_threshold_ms: NotRequired[int]
    _experiments: NotRequired[Any]  # TODO


class ServerSdkConfig(SdkConfig):
    # these get popped before sending along to the sdk
    dsn: NotRequired[str]
    relay_dsn: NotRequired[str]
    experimental_dsn: NotRequired[str]
