from __future__ import annotations

import threading
from collections import deque
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta
from types import TracebackType
from typing import Generator, Type

from sentry_sdk.tracing import Span


@dataclass(frozen=True)
class RpcMetricRecord:
    """A record of a completed RPC."""

    service_name: str
    method_name: str
    duration: timedelta

    @classmethod
    @contextmanager
    def measure(cls, service_name: str, method_name: str) -> Generator[None, None, None]:
        """Measure an RPC and capture the result in any open spans."""
        start = datetime.utcnow()
        yield
        end = datetime.utcnow()
        record = cls(service_name, method_name, duration=end - start)
        RpcMetricTracker.get_local().save_record(record)


_LOCAL_TRACKER = threading.local()


class RpcMetricTracker:
    """An object that keeps track of any open RpcMetricSpans.

    Each instance of this class is a thread-local singleton. It is not thread-safe
    and is expected not to escape the thread where it was created.
    """

    def __init__(self) -> None:
        self.spans: deque[RpcMetricSpan] = deque()

    @classmethod
    def get_local(cls) -> RpcMetricTracker:
        try:
            return _LOCAL_TRACKER.tracker
        except AttributeError:
            new_tracker = _LOCAL_TRACKER.tracker = cls()
            return new_tracker

    def save_record(self, record: RpcMetricRecord):
        for span in self.spans:
            span.records.append(record)


class RpcMetricSpan:
    """A span in which we want to capture all executed RPCs.

    Spans may be nested. When a record is created by the `RpcMetricRecord.measure`
    method, it is captured by all open RpcMetricSpans in the same thread.
    """

    def __init__(self) -> None:
        self.records: list[RpcMetricRecord] = []

    def __enter__(self) -> RpcMetricSpan:
        RpcMetricTracker.get_local().spans.append(self)
        return self

    def __exit__(
        self,
        exc_type: Type[BaseException] | None,
        exc_val: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        # We expect last-in-first-out order to be maintained as long as all spans are
        # opened correctly in a `with` block. It may not actually matter much if
        # spans are closed out of order, in which case we could do
        # `spans.remove(self)` instead of `spans.pop()`.
        popped = RpcMetricTracker.get_local().spans.pop()
        assert self is popped, "Stack of spans not maintained correctly"

    @property
    def rpc_count(self) -> int:
        return len(self.records)

    @property
    def total_duration(self) -> timedelta:
        return sum((r.duration for r in self.records), timedelta())

    @property
    def mean_duration(self) -> timedelta | None:
        if self.rpc_count == 0:
            return None
        return self.total_duration / self.rpc_count


@contextmanager
def wrap_sdk_span(sdk_span: Span) -> Generator[None, None, None]:
    """Capture an RpcMetricSpan's output in a Sentry SDK span.

    Generally, this context manager should be nested inside the SDK span. Example:

    ```
        with sentry_sdk.start_span(...) as span:
            with rpcmetrics.wrap_sdk_span(span):
                execute()
    ```
    """

    with RpcMetricSpan() as rpc_span:
        yield

        mean_duration = rpc_span.mean_duration
        sdk_span.set_data("rpc.count", rpc_span.rpc_count)
        sdk_span.set_data(
            "rpc.mean_duration_in_ms",
            mean_duration.total_seconds() * 1000 if mean_duration is not None else None,
        )
        sdk_span.set_data(
            "rpc.records",
            [
                {
                    "service_name": r.service_name,
                    "method_name": r.method_name,
                    "duration_in_ms": r.duration.total_seconds() * 1000,
                }
                for r in rpc_span.records
            ],
        )
