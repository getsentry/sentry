from __future__ import annotations

import socket
import threading
from collections.abc import Generator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from unittest import mock

import pytest
import requests

from sentry.hybridcloud.rpc.attempt_instrumentation import (
    InstrumentedConnectionMixin,
    InstrumentedHTTPAdapter,
    InstrumentedHTTPConnectionPool,
    InstrumentedHTTPSConnection,
    InstrumentedHTTPSConnectionPool,
    ObservedRetry,
    _rpc_call,
    observe_rpc_call,
)
from sentry.hybridcloud.rpc.service import _create_request_session, _RemoteSiloCall
from sentry.testutils.helpers import override_options
from sentry.types.cell import Cell

ENABLED = {"hybridcloud.rpc.attempt_observability.enabled": True}


class _ScriptedHandler(BaseHTTPRequestHandler):
    # Keep-alive so retries reuse the pooled connection.
    protocol_version = "HTTP/1.1"
    statuses: list[int] = []
    requests_seen = 0

    def do_POST(self) -> None:
        cls = type(self)
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        status = cls.statuses[min(cls.requests_seen, len(cls.statuses) - 1)]
        cls.requests_seen += 1

        body = b'{"meta": {}, "value": null}' if status == 200 else b"nope"
        self.send_response(status)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args: Any) -> None:
        pass


@pytest.fixture
def scripted_server() -> Generator[type[_ScriptedHandler]]:
    """An HTTP server whose responses are scripted per-request via ``statuses``."""

    class Handler(_ScriptedHandler):
        statuses = [200]
        requests_seen = 0

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    Handler.address = f"http://127.0.0.1:{server.server_address[1]}"  # type: ignore[attr-defined]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield Handler
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


@pytest.fixture
def closed_port() -> int:
    """A port with nothing listening, so connections are refused deterministically."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    return port


def _spans(start_span: mock.MagicMock) -> list[str]:
    return [call.kwargs["op"] for call in start_span.call_args_list]


@override_options(ENABLED)
def test_records_a_span_per_attempt_when_retrying(scripted_server: Any) -> None:
    scripted_server.statuses = [503, 503, 200]
    session = _create_request_session(retry_count=5)

    with (
        mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.start_span") as start_span,
        mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.set_span_data") as set_span_data,
    ):
        with observe_rpc_call("organization_service.get_organization_by_id", "us") as call:
            response = session.post(scripted_server.address, data=b"{}", timeout=5)

    assert response.status_code == 200
    assert scripted_server.requests_seen == 3
    assert call.attempts == 3

    attempt_spans = [op for op in _spans(start_span) if op == "hybrid_cloud.dispatch_rpc.attempt"]
    assert len(attempt_spans) == 3

    reuse = [
        c.args[2] for c in set_span_data.call_args_list if c.args[1] == "http.connection.reused"
    ]
    assert reuse == [False, True, True]


@override_options(ENABLED)
def test_records_a_span_per_attempt_when_the_connection_fails(closed_port: int) -> None:
    """
    Connection failures are the case with no coverage without this instrumentation: the
    SDK's http.client span is opened in putrequest and only closed in getresponse, so a
    call that never connects records no attempt spans at all.
    """
    session = _create_request_session(retry_count=2)

    with mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.start_span") as start_span:
        with observe_rpc_call("organization_service.get_organization_by_id", "us") as call:
            with pytest.raises(requests.exceptions.ConnectionError):
                session.post(f"http://127.0.0.1:{closed_port}/rpc", data=b"{}", timeout=5)

    assert call.attempts == 3
    ops = _spans(start_span)
    assert ops.count("hybrid_cloud.dispatch_rpc.attempt") == 3
    assert ops.count("socket.getaddrinfo") == 3
    assert ops.count("socket.connect") == 3


@override_options(ENABLED)
def test_records_attempt_metrics(scripted_server: Any) -> None:
    scripted_server.statuses = [503, 200]
    session = _create_request_session(retry_count=5)

    with mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.metrics") as metrics:
        with observe_rpc_call("organization_service.get_organization_by_id", "us"):
            session.post(scripted_server.address, data=b"{}", timeout=5)

    outcomes = [
        call.kwargs["tags"]
        for call in metrics.incr.call_args_list
        if call.args[0] == "hybrid_cloud.dispatch_rpc.attempt.outcome"
    ]
    assert [tags["status_class"] for tags in outcomes] == ["5xx", "2xx"]
    assert [tags["error_kind"] for tags in outcomes] == ["none", "none"]
    assert [tags["connection"] for tags in outcomes] == ["new", "reused"]

    timed = [call.args[0] for call in metrics.timer.call_args_list]
    assert timed == ["hybrid_cloud.dispatch_rpc.attempt.duration"] * 2

    phases = [
        call.kwargs["tags"]["phase"]
        for call in metrics.distribution.call_args_list
        if call.args[0] == "hybrid_cloud.dispatch_rpc.connect.duration"
    ]
    assert phases == ["dns", "tcp"]


@override_options(ENABLED)
def test_records_error_kind_for_refused_connections(closed_port: int) -> None:
    session = _create_request_session(retry_count=1)

    with mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.metrics") as metrics:
        with observe_rpc_call("organization_service.get_organization_by_id", "us"):
            with pytest.raises(requests.exceptions.ConnectionError):
                session.post(f"http://127.0.0.1:{closed_port}/rpc", data=b"{}", timeout=5)

    error_kinds = {
        call.kwargs["tags"]["error_kind"]
        for call in metrics.incr.call_args_list
        if call.args[0] == "hybrid_cloud.dispatch_rpc.attempt.outcome"
    }
    assert error_kinds == {"connect_refused"}


@override_options(ENABLED)
def test_records_backoff_duration(scripted_server: Any) -> None:
    scripted_server.statuses = [503, 503, 200]
    session = _create_request_session(retry_count=5)

    with mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.metrics") as metrics:
        with observe_rpc_call("organization_service.get_organization_by_id", "us"):
            session.post(scripted_server.address, data=b"{}", timeout=5)

    backoffs = [
        call.args[1]
        for call in metrics.distribution.call_args_list
        if call.args[0] == "hybrid_cloud.dispatch_rpc.backoff.duration"
    ]
    # urllib3 does not sleep before the first retry.
    assert len(backoffs) == 2
    assert backoffs[1] > backoffs[0]


def test_emits_nothing_while_the_option_is_disabled(scripted_server: Any) -> None:
    scripted_server.statuses = [503, 200]
    session = _create_request_session(retry_count=5)

    with override_options({"hybridcloud.rpc.attempt_observability.enabled": False}):
        with (
            mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.start_span") as start_span,
            mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.metrics") as metrics,
        ):
            with observe_rpc_call("organization_service.get_organization_by_id", "us") as call:
                response = session.post(scripted_server.address, data=b"{}", timeout=5)

    assert response.status_code == 200
    assert call.attempts == 0
    assert start_span.call_args_list == []
    assert metrics.incr.call_args_list == []


@override_options(ENABLED)
def test_response_body_is_not_consumed(scripted_server: Any) -> None:
    """The pool hook must not read the body: requests preloads it lazily."""
    scripted_server.statuses = [200]
    session = _create_request_session(retry_count=5)

    with observe_rpc_call("organization_service.get_organization_by_id", "us"):
        response = session.post(scripted_server.address, data=b"{}", timeout=5)

    assert response.json() == {"meta": {}, "value": None}


@override_options(ENABLED)
def test_the_call_context_is_reset(closed_port: int) -> None:
    session = _create_request_session(retry_count=0)

    with observe_rpc_call("organization_service.get_organization_by_id", "us"):
        assert _rpc_call.get() is not None
    assert _rpc_call.get() is None

    with pytest.raises(requests.exceptions.ConnectionError):
        with observe_rpc_call("organization_service.get_organization_by_id", "us"):
            session.post(f"http://127.0.0.1:{closed_port}/rpc", data=b"{}", timeout=5)
    assert _rpc_call.get() is None


@override_options(ENABLED)
def test_connection_timings_are_populated(scripted_server: Any) -> None:
    """
    Guards the urllib3 internals this module reimplements. A urllib3 upgrade that
    reshapes _new_conn or _make_request should fail loudly here rather than
    silently zeroing out the connect metrics.
    """
    scripted_server.statuses = [200]
    host, port = "127.0.0.1", int(scripted_server.address.rsplit(":", 1)[1])
    pool = InstrumentedHTTPConnectionPool(host, port)

    try:
        with observe_rpc_call("organization_service.get_organization_by_id", "us") as call:
            pool.urlopen("POST", "/rpc", body=b"{}", retries=False)

            assert call.attempts == 1
            assert call.pending_dns_ms is not None
            assert call.pending_connect_ms is not None
    finally:
        pool.close()


def test_session_is_built_with_the_instrumented_adapter() -> None:
    session = _create_request_session(retry_count=3)

    for scheme in ("http://", "https://"):
        adapter = session.adapters[scheme]
        assert isinstance(adapter, InstrumentedHTTPAdapter)
        assert isinstance(adapter.max_retries, ObservedRetry)
        assert adapter.max_retries.total == 3


def test_observed_retry_survives_increment() -> None:
    """Retry.new() reconstructs via type(self), so the subclass must stay stateless."""
    retry = ObservedRetry(total=3, backoff_factor=0.1, allowed_methods=["POST"])

    incremented = retry.increment("POST", "/rpc", error=OSError("boom"))

    assert isinstance(incremented, ObservedRetry)
    assert incremented.total == 2


@pytest.mark.django_db
@override_options(ENABLED)
def test_connect_timeouts_are_tagged_separately(closed_port: int) -> None:
    """
    ConnectTimeout subclasses both ConnectionError and Timeout, so it has to be caught
    before ConnectionError to avoid being reported as a generic connection error.
    """
    call = _RemoteSiloCall(
        cell=Cell("us", 1, f"http://127.0.0.1:{closed_port}"),
        service_name="organization_service",
        method_name="get_organization_by_id",
        serial_arguments={},
    )

    with (
        mock.patch("sentry.hybridcloud.rpc.service.metrics.incr") as incr,
        mock.patch(
            "requests.sessions.Session.post",
            side_effect=requests.exceptions.ConnectTimeout("too slow"),
        ),
    ):
        with pytest.raises(Exception, match="Timeout of"):
            call._fire_request({}, b"{}")

    kinds = [c.kwargs["tags"]["kind"] for c in incr.call_args_list if "kind" in c.kwargs["tags"]]
    assert kinds == ["connecttimeout"]


@override_options(ENABLED)
def test_instruments_https_connections(scripted_server: Any) -> None:
    """
    The https pool uses a separate connection class, whose MRO must still reach the
    instrumented _new_conn. Exercised against a TLS server rather than asserted
    structurally, so a urllib3 change to HTTPSConnection.connect would surface here.
    """
    scripted_server.statuses = [200]
    session = _create_request_session(retry_count=0)
    adapter = session.adapters["https://"]
    pool = adapter.poolmanager.connection_from_url("https://127.0.0.1:1/")

    assert isinstance(pool, InstrumentedHTTPSConnectionPool)
    assert pool.ConnectionCls is InstrumentedHTTPSConnection
    assert InstrumentedHTTPSConnection._new_conn is InstrumentedConnectionMixin._new_conn

    with mock.patch("sentry.hybridcloud.rpc.attempt_instrumentation.start_span") as start_span:
        with observe_rpc_call("organization_service.get_organization_by_id", "us") as call:
            with pytest.raises(requests.exceptions.ConnectionError):
                session.post("https://127.0.0.1:1/rpc", data=b"{}", timeout=5)

    assert call.attempts == 1
    assert _spans(start_span).count("socket.connect") == 1
