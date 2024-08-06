from datetime import datetime, timedelta
from unittest import mock

import pytest
import sentry_sdk
import sentry_sdk.scope
from sentry_sdk import Client, Transport

from sentry.metrics.composite_experimental import CompositeExperimentalMetricsBackend
from sentry.metrics.minimetrics import MiniMetricsMetricsBackend
from sentry.testutils.helpers import override_options


def full_flush(scope):
    # first flush flushes the metrics
    scope.client.flush()

    # second flush should really not do anything unless the first
    # flush accidentally created more metrics
    scope.client.flush()


class DummyTransport(Transport):
    def __init__(self, options):
        self.captured = []

    def capture_envelope(self, envelope):
        self.captured.append(envelope)

    def get_spans(self):
        tx = self.get_transaction()
        if tx is None:
            return []

        return tx["spans"]

    def get_transaction(self):
        for envelope in self.captured:
            for item in envelope.items:
                if item.headers.get("type") == "transaction":
                    return item.payload.json


@pytest.fixture(scope="function")
def scope():
    scope = sentry_sdk.Scope(
        ty=sentry_sdk.scope.ScopeType.CURRENT,
        client=Client(
            dsn="http://foo@example.invalid/42",
            transport=DummyTransport,
            traces_sample_rate=1.0,
        ),
    )
    with sentry_sdk.scope.use_scope(scope):
        yield scope


@pytest.fixture(scope="function")
def backend():
    # Make sure we also patch the global metrics backend as the backend
    # will forward internal metrics to it (back into itself).  If we don't
    # set this up correctly, we might accidentally break our recursion
    # protection and not see these tests fail.
    rv = MiniMetricsMetricsBackend(prefix="sentrytest.")
    with mock.patch("sentry.utils.metrics.backend", new=rv):
        yield rv


def test_incr(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.incr(key="foo")

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert span["data"]["foo"] == 1


def test_incr_with_tag(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.incr(key="foo", tags={"x": "y"})

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert span["data"]["foo"] == 1
    assert span["data"]["x"] == "y"


def test_incr_multi(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.incr(key="foo", tags={"x": "y"})
            backend.incr(key="foo", tags={"x": "z"})

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert span["data"]["foo"] == 1  # NB: SDK has no get_data() -> incr impossible
    assert span["data"]["x"] == "z"


def test_gauge(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.gauge(key="foo", value=0)
            backend.gauge(key="foo", value=42.0)

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert span["data"]["foo"] == 42.0


def test_distribution(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.distribution(key="foo", value=0)
            backend.distribution(key="foo", value=42.0)

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert span["data"]["foo"] == 42.0


def test_timing(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test"):
            backend.timing(key="foo", value=42.1, tags={"x": "y"})

    full_flush(scope)
    (parent, child) = scope.client.transport.get_spans()

    assert parent["op"] == "test"
    assert child["op"] == "foo"
    assert child["data"]["x"] == "y"

    duration = datetime.fromisoformat(child["timestamp"]) - datetime.fromisoformat(
        child["start_timestamp"]
    )
    assert duration == timedelta(seconds=42.1)


def test_timing_duplicate(backend, scope):
    with scope.start_transaction():
        # We often manually track a span + a timer with same name. In this case
        # we want no additional span.
        with scope.start_span(op="test"):
            backend.timing(key="test", value=42.0, tags={"x": "y"})

    full_flush(scope)
    (span,) = scope.client.transport.get_spans()

    assert span["op"] == "test"
    assert "test" not in span["data"]
    assert span["data"]["x"] == "y"

    # NB: Explicit timing is discarded


def test_no_transaction(backend, scope):
    backend.incr(key="foo")

    full_flush(scope)
    assert not scope.client.transport.get_spans()


@override_options({"delightful_metrics.minimetrics_sample_rate": 1.0})
def test_composite_backend_does_not_recurse(scope):
    composite_backend = CompositeExperimentalMetricsBackend(
        primary_backend="sentry.metrics.dummy.DummyMetricsBackend"
    )
    accessed = set()

    class TrackingCompositeBackend:
        def __getattr__(self, name):
            assert name not in accessed
            accessed.add(name)
            return getattr(composite_backend, name)

    # make sure the backend feeds back to itself
    with mock.patch("sentry.utils.metrics.backend", new=TrackingCompositeBackend()) as backend:
        with scope.start_transaction():
            with scope.start_span(op="test"):
                backend.incr(key="sentrytest.composite", tags={"x": "bar"})
        full_flush(scope)

    (span,) = scope.client.transport.get_spans()
    assert span["data"]["sentrytest.composite"] == 1
