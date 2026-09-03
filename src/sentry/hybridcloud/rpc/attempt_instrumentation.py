from __future__ import annotations

import socket
import time
from collections.abc import Generator, Mapping
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from requests.adapters import DEFAULT_POOLBLOCK, HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool
from urllib3.exceptions import (
    ConnectTimeoutError,
    NameResolutionError,
    NewConnectionError,
    ProtocolError,
    ReadTimeoutError,
)
from urllib3.poolmanager import PoolManager
from urllib3.response import BaseHTTPResponse
from urllib3.util.connection import _set_socket_options, allowed_gai_family
from urllib3.util.retry import Retry

from sentry import options
from sentry.metrics.base import Tags
from sentry.utils import metrics
from sentry.utils.tracing import set_span_data, set_span_tag, start_span

# Ordered most-specific-first: urllib3 nests these, e.g. NameResolutionError is a
# subclass of NewConnectionError, which is itself a subclass of ConnectTimeoutError.
_ERROR_KINDS: tuple[tuple[type[BaseException], str], ...] = (
    (NameResolutionError, "dns"),
    (NewConnectionError, "connect_refused"),
    (ConnectTimeoutError, "connect_timeout"),
    (ReadTimeoutError, "read_timeout"),
    (ProtocolError, "protocol"),
)


def _error_kind(error: BaseException) -> str:
    for error_type, kind in _ERROR_KINDS:
        if isinstance(error, error_type):
            return kind
    return "other"


def _status_class(status: int) -> str:
    return f"{status // 100}xx"


@dataclass
class RpcCallObservability:
    """Per-call state for a single logical RPC, spanning all of its retry attempts."""

    rpc_method: str
    rpc_destination_region: str
    attempts: int = 0
    # Written by the connection when it establishes a socket, then read and
    # cleared by the pool. Stays None when a pooled connection is reused.
    pending_dns_ms: float | None = field(default=None, repr=False)
    pending_connect_ms: float | None = field(default=None, repr=False)

    def tags(self, **additional: str | int | bool) -> Tags:
        return dict(
            rpc_method=self.rpc_method,
            rpc_destination_region=self.rpc_destination_region,
            **additional,
        )


# A ContextVar rather than a threadlocal so the call context survives
# ContextPropagatingThreadPoolExecutor, which copies contextvars into its workers
# and is used to fan RPCs out across cells.
_rpc_call: ContextVar[RpcCallObservability | None] = ContextVar(
    "sentry.hybridcloud.rpc.attempt_observability", default=None
)


def _active_call() -> RpcCallObservability | None:
    if not options.get("hybridcloud.rpc.attempt_observability.enabled"):
        return None
    return _rpc_call.get()


@contextmanager
def observe_rpc_call(
    rpc_method: str, rpc_destination_region: str
) -> Generator[RpcCallObservability]:
    observability = RpcCallObservability(rpc_method, rpc_destination_region)
    token = _rpc_call.set(observability)
    try:
        yield observability
    finally:
        _rpc_call.reset(token)


class InstrumentedConnectionMixin(HTTPConnection):
    """
    Adapted from urllib3.connection.HTTPConnection._new_conn so DNS resolution and
    the TCP connect can be timed separately. Without this, a failed connection
    produces no spans at all: the SDK's http.client span is opened in putrequest
    and only closed in getresponse, which a connection failure never reaches.

    Mirrors the approach in sentry.net.http.SafeConnectionMixin.
    """

    def _new_conn(self) -> socket.socket:
        observability = _active_call()
        if observability is None:
            return super()._new_conn()

        host, port = self._dns_host, self.port

        dns_start = time.perf_counter()
        with start_span(op="socket.getaddrinfo", name=f"DNS resolve: {host}") as span:
            try:
                addresses = socket.getaddrinfo(host, port, allowed_gai_family(), socket.SOCK_STREAM)
            except socket.gaierror as e:
                self._record_phase(observability, "dns", dns_start, ok=False)
                raise NameResolutionError(host, self, e) from e
            set_span_data(span, "address_count", len(addresses))
        observability.pending_dns_ms = self._record_phase(observability, "dns", dns_start, ok=True)

        err: BaseException | None = None
        connect_start = time.perf_counter()
        for af, socktype, proto, _canonname, sa in addresses:
            sock = None
            try:
                sock = socket.socket(af, socktype, proto)
                _set_socket_options(sock, self.socket_options)
                sock.settimeout(self.timeout)
                if self.source_address:
                    sock.bind(self.source_address)
                with start_span(op="socket.connect", name=f"sock.connect{sa}"):
                    sock.connect(sa)
            except OSError as e:
                err = e
                if sock is not None:
                    sock.close()
                continue

            observability.pending_connect_ms = self._record_phase(
                observability, "tcp", connect_start, ok=True
            )
            return sock

        self._record_phase(observability, "tcp", connect_start, ok=False)

        # Raise the same exception types urllib3 does, so that requests' own
        # translation in HTTPAdapter.send keeps behaving identically.
        if isinstance(err, socket.timeout):
            raise ConnectTimeoutError(
                self,
                f"Connection to {self.host} timed out. (connect timeout={self.timeout})",
            )
        raise NewConnectionError(self, f"Failed to establish a new connection: {err}")

    @staticmethod
    def _record_phase(
        observability: RpcCallObservability, phase: str, start: float, ok: bool
    ) -> float:
        elapsed_ms = (time.perf_counter() - start) * 1000
        metrics.distribution(
            "hybrid_cloud.dispatch_rpc.connect.duration",
            elapsed_ms,
            tags={
                "rpc_destination_region": observability.rpc_destination_region,
                "phase": phase,
                "result": "success" if ok else "failure",
            },
            unit="millisecond",
        )
        return elapsed_ms


class InstrumentedHTTPConnection(InstrumentedConnectionMixin):
    pass


class InstrumentedHTTPSConnection(InstrumentedConnectionMixin, HTTPSConnection):
    pass


class InstrumentedPoolMixin(HTTPConnectionPool):
    """
    Wraps each individual attempt urllib3 makes, including the retries it performs
    internally, so a call that exhausts its retry budget still reports every attempt.
    """

    def _make_request(
        self, conn: Any, method: str, url: str, *args: Any, **kwargs: Any
    ) -> BaseHTTPResponse:
        observability = _active_call()
        if observability is None:
            return super()._make_request(conn, method, url, *args, **kwargs)

        observability.attempts += 1
        attempt = observability.attempts
        reused = conn.sock is not None
        observability.pending_dns_ms = None
        observability.pending_connect_ms = None

        span = start_span(
            op="hybrid_cloud.dispatch_rpc.attempt",
            name=f"rpc attempt {attempt} to {observability.rpc_method}",
        )
        with (
            span,
            metrics.timer("hybrid_cloud.dispatch_rpc.attempt.duration", tags=observability.tags()),
        ):
            set_span_tag(span, "rpc_method", observability.rpc_method)
            set_span_tag(span, "rpc_destination_region", observability.rpc_destination_region)
            set_span_data(span, "rpc.attempt", attempt)
            set_span_data(span, "http.connection.reused", reused)
            set_span_data(span, "server.address", f"{conn.host}:{conn.port}")

            try:
                response = super()._make_request(conn, method, url, *args, **kwargs)
            except BaseException as e:
                error_kind = _error_kind(e)
                self._annotate_connection(span, observability)
                set_span_data(span, "rpc.error_kind", error_kind)
                self._record_outcome(
                    observability, reused=reused, status=None, error_kind=error_kind
                )
                raise

            self._annotate_connection(span, observability)
            set_span_data(span, "http.response.status_code", response.status)
            # Never read the body here: requests passes preload_content=False, so
            # consuming it would leave the caller with an empty response.
            content_length = response.headers.get("Content-Length")
            if content_length is not None and content_length.isdigit():
                set_span_data(span, "http.response.body.size", int(content_length))
            self._record_outcome(
                observability, reused=reused, status=response.status, error_kind="none"
            )
            return response

    @staticmethod
    def _annotate_connection(span: Any, observability: RpcCallObservability) -> None:
        if observability.pending_dns_ms is not None:
            set_span_data(span, "http.connection.dns_ms", observability.pending_dns_ms)
        if observability.pending_connect_ms is not None:
            set_span_data(span, "http.connection.connect_ms", observability.pending_connect_ms)

    @staticmethod
    def _record_outcome(
        observability: RpcCallObservability, *, reused: bool, status: int | None, error_kind: str
    ) -> None:
        metrics.incr(
            "hybrid_cloud.dispatch_rpc.attempt.outcome",
            tags={
                "rpc_destination_region": observability.rpc_destination_region,
                "status_class": _status_class(status) if status is not None else "none",
                "error_kind": error_kind,
                "connection": "reused" if reused else "new",
            },
        )


class InstrumentedHTTPConnectionPool(InstrumentedPoolMixin):
    ConnectionCls = InstrumentedHTTPConnection


class InstrumentedHTTPSConnectionPool(InstrumentedPoolMixin, HTTPSConnectionPool):
    ConnectionCls = InstrumentedHTTPSConnection


class InstrumentedPoolManager(PoolManager):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # Set on the instance rather than the class, matching sentry.net.http.SafePoolManager,
        # because PoolManager.__init__ reads the class-level default.
        self.pool_classes_by_scheme = {
            "http": InstrumentedHTTPConnectionPool,
            "https": InstrumentedHTTPSConnectionPool,
        }


class InstrumentedHTTPAdapter(HTTPAdapter):
    """Builds an InstrumentedPoolManager rather than the default PoolManager."""

    def init_poolmanager(
        self, connections: int, maxsize: int, block: bool = DEFAULT_POOLBLOCK, **pool_kwargs: Any
    ) -> None:
        self._pool_connections = connections
        self._pool_maxsize = maxsize
        self._pool_block = block
        self.poolmanager = InstrumentedPoolManager(
            num_pools=connections, maxsize=maxsize, block=block, **pool_kwargs
        )


class ObservedRetry(Retry):
    """
    Records time spent sleeping between attempts, which is the one part of a retried
    call that the pool-level hooks cannot see: urlopen sleeps between _make_request calls.

    Holds no extra instance state, so Retry.new() reconstructs it correctly on increment().
    """

    def sleep(self, response: BaseHTTPResponse | None = None) -> None:
        start = time.perf_counter()
        try:
            super().sleep(response)
        finally:
            observability = _active_call()
            if observability is not None:
                metrics.distribution(
                    "hybrid_cloud.dispatch_rpc.backoff.duration",
                    (time.perf_counter() - start) * 1000,
                    tags={"rpc_destination_region": observability.rpc_destination_region},
                    unit="millisecond",
                )


def record_call_attempts(observability: RpcCallObservability, tags: Mapping[str, Any]) -> None:
    if not options.get("hybridcloud.rpc.attempt_observability.enabled"):
        return
    metrics.distribution(
        "hybrid_cloud.dispatch_rpc.attempts", observability.attempts, tags=dict(tags)
    )
