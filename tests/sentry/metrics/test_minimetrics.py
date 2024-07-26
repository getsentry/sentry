from typing import Any
from unittest import mock
from unittest.mock import patch

import pytest
import sentry_sdk
import sentry_sdk.scope
from sentry_sdk import Client, Transport

from sentry.metrics.composite_experimental import CompositeExperimentalMetricsBackend
from sentry.metrics.minimetrics import MiniMetricsMetricsBackend, before_emit_metric
from sentry.testutils.helpers import override_options


def full_flush(scope):
    # first flush flushes the metrics
    scope.client.flush()

    # second flush should really not do anything unless the first
    # flush accidentally created more metrics
    scope.client.flush()


def parse_metrics(bytes: bytes):
    rv = []
    for line in bytes.splitlines():
        pieces = line.decode("utf-8").split("|")
        payload = pieces[0].split(":")
        name = payload[0]
        values = payload[1:]
        ty = pieces[1]
        ts = None
        tags: dict[str, Any] = {}
        for piece in pieces[2:]:
            if piece[0] == "#":
                for pair in piece[1:].split(","):
                    k, v = pair.split(":", 1)
                    old = tags.get(k)
                    if old is not None:
                        if isinstance(old, list):
                            old.append(v)
                        else:
                            tags[k] = [old, v]
                    else:
                        tags[k] = v
            elif piece[0] == "T":
                ts = int(piece[1:])
            else:
                raise ValueError(f"unknown piece {piece!r}")
        rv.append((ts, name, ty, values, tags))
    rv.sort(key=lambda x: (x[0], x[1], tuple(sorted(tags.items()))))
    return rv


class DummyTransport(Transport):
    def __init__(self, options):
        self.captured = []

    def capture_envelope(self, envelope):
        self.captured.append(envelope)

    def get_spans(self):
        for envelope in self.captured:
            for item in envelope.items:
                if item.headers.get("type") == "transaction":
                    return item.payload.json["spans"]

    def get_metrics(self):
        result = []
        for envelope in self.captured:
            for item in envelope.items:
                if item.headers.get("type") == "statsd":
                    result.extend(parse_metrics(item.payload.get_bytes()))
        result.sort(key=lambda x: (x[0], x[1], x[2]))
        return result


@pytest.fixture(scope="function")
def scope():
    scope = sentry_sdk.Scope(
        ty=sentry_sdk.scope.ScopeType.CURRENT,
        client=Client(
            dsn="http://foo@example.invalid/42",
            transport=DummyTransport,
            _experiments={
                "enable_metrics": True,
                "before_emit_metric": before_emit_metric,  # type: ignore[typeddict-item]
            },
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


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_incr_called_with_no_tags(backend, scope):
    backend.incr(key="foo", tags={"x": "y"})
    full_flush(scope)

    metrics = scope.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "c"
    assert metrics[0][3] == ["1.0"]
    assert metrics[0][4]["release"] != ""
    assert metrics[0][4]["environment"] != ""
    assert metrics[0][4]["x"] == "y"

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": False,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_incr_called_with_no_tags_and_no_common_tags(backend, scope):
    backend.incr(key="foo", tags={"x": "y"})
    full_flush(scope)

    metrics = scope.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "c"
    assert metrics[0][3] == ["1.0"]
    assert metrics[0][4].get("release") is None
    assert metrics[0][4].get("environment") is None
    assert metrics[0][4]["x"] == "y"

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_incr_called_with_tag_value_as_list(backend, scope):
    # The minimetrics backend supports the list type.
    backend.incr(key="foo", tags={"x": ["bar", "baz"]})
    full_flush(scope)

    metrics = scope.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][4]["x"] == ["bar", "baz"]

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.emit_gauges": False,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_gauge_as_count(backend, scope):
    # The minimetrics backend supports the list type.
    backend.gauge(key="foo", value=42.0)
    full_flush(scope)

    metrics = scope.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "c"
    assert metrics[0][3] == ["42.0"]

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.emit_gauges": True,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_gauge(backend, scope):
    # The minimetrics backend supports the list type.
    backend.gauge(key="foo", value=42.0)
    full_flush(scope)

    metrics = scope.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "g"
    assert metrics[0][3] == ["42.0", "42.0", "42.0", "42.0", "1"]

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.minimetrics_sample_rate": 1.0,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_composite_backend_does_not_recurse(scope):
    composite_backend = CompositeExperimentalMetricsBackend(
        primary_backend="sentry.metrics.dummy.DummyMetricsBackend"
    )
    accessed = set()

    class TrackingCompositeBackend:
        def __getattr__(self, name):
            accessed.add(name)
            return getattr(composite_backend, name)

    # make sure the backend feeds back to itself
    with mock.patch("sentry.utils.metrics.backend", new=TrackingCompositeBackend()):
        composite_backend.incr(key="sentrytest.composite", tags={"x": "bar"})
        full_flush(scope)

    # make sure that we did actually internally forward to the composite
    # backend so the test does not accidentally succeed.
    assert "incr" in accessed
    assert "distribution" in accessed

    metrics = scope.client.transport.get_metrics()

    # the minimetrics.add metric must not show up
    assert len(metrics) == 1
    assert metrics[0][1] == "sentry.sentrytest.composite@none"
    assert metrics[0][4]["x"] == "bar"

    assert len(scope.client.metrics_aggregator.buckets) == 0


@override_options(
    {
        "delightful_metrics.minimetrics_sample_rate": 1.0,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
@patch("sentry.metrics.minimetrics.sentry_sdk")
@pytest.mark.parametrize("unit,expected_unit", [(None, "none"), ("second", "second")])
def test_unit_is_correctly_propagated_for_incr(sentry_sdk, unit, expected_unit):
    backend = MiniMetricsMetricsBackend(prefix="")

    params = {"key": "sentrytest.unit", "value": 10.0, "tags": {"x": "bar"}, "unit": unit}

    # We want to mutate the params since `value` is passed as `amount`.
    incr_params = params.copy()
    del incr_params["value"]
    incr_params["amount"] = params["value"]
    backend.incr(**incr_params)
    assert sentry_sdk.metrics.incr.call_args.kwargs == {
        **params,
        "unit": expected_unit,
        "stacklevel": 1,
    }


@override_options(
    {
        "delightful_metrics.minimetrics_sample_rate": 1.0,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
@patch("sentry.metrics.minimetrics.sentry_sdk")
@pytest.mark.parametrize("unit,expected_unit", [(None, "second"), ("second", "second")])
def test_unit_is_correctly_propagated_for_timing(sentry_sdk, unit, expected_unit):
    backend = MiniMetricsMetricsBackend(prefix="")

    params = {"key": "sentrytest.unit", "value": 10.0, "tags": {"x": "bar"}}

    backend.timing(**params)  # type: ignore[arg-type]
    assert sentry_sdk.metrics.distribution.call_args.kwargs == {
        **params,
        "unit": expected_unit,
        "stacklevel": 1,
    }


@override_options(
    {
        "delightful_metrics.minimetrics_sample_rate": 1.0,
        "delightful_metrics.emit_gauges": True,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
@patch("sentry.metrics.minimetrics.sentry_sdk")
@pytest.mark.parametrize("unit,expected_unit", [(None, "none"), ("second", "second")])
def test_unit_is_correctly_propagated_for_gauge(sentry_sdk, unit, expected_unit):
    backend = MiniMetricsMetricsBackend(prefix="")

    params = {"key": "sentrytest.unit", "value": 10.0, "tags": {"x": "bar"}, "unit": unit}

    backend.gauge(**params)
    assert sentry_sdk.metrics.gauge.call_args.kwargs == {
        **params,
        "unit": expected_unit,
        "stacklevel": 1,
    }


@override_options(
    {
        "delightful_metrics.minimetrics_sample_rate": 1.0,
        "delightful_metrics.enable_span_attributes": False,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
@patch("sentry.metrics.minimetrics.sentry_sdk")
@pytest.mark.parametrize("unit,expected_unit", [(None, "none"), ("second", "second")])
def test_unit_is_correctly_propagated_for_distribution(sentry_sdk, unit, expected_unit):
    backend = MiniMetricsMetricsBackend(prefix="")

    params = {"key": "sentrytest.unit", "value": 15.0, "tags": {"x": "bar"}, "unit": unit}

    backend.distribution(**params)
    assert sentry_sdk.metrics.distribution.call_args.kwargs == {
        **params,
        "unit": expected_unit,
        "stacklevel": 1,
    }


@pytest.mark.parametrize(
    "unit,default,expected_result",
    [
        (None, None, "none"),
        (None, "my_default", "my_default"),
        ("second", None, "second"),
        ("second", "my_default", "second"),
    ],
)
def test_to_minimetrics_unit(unit, default, expected_result):
    result = MiniMetricsMetricsBackend._to_minimetrics_unit(unit, default)
    assert result == expected_result


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.enable_span_attributes": True,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_span_attributes_if_there_is_no_active_span(backend, scope):
    backend.incr(key="metric_withspan", tags={"x": "bar"})
    full_flush(scope)

    spans = scope.client.transport.get_spans()
    assert not spans


@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
        "delightful_metrics.enable_common_tags": True,
        "delightful_metrics.enable_span_attributes": True,
        "delightful_metrics.enable_code_locations": True,
        "delightful_metrics.minimetrics_disable_legacy": False,
    }
)
def test_span_attribute_is_attached_if_span_exists(backend, scope):
    with scope.start_transaction():
        with scope.start_span(op="test.incr"):
            backend.incr(key="metric_withspan", tags={"x": "bar"})
            full_flush(scope)

    spans = scope.client.transport.get_spans()

    assert len(spans) == 1
    span = spans[0]
    assert span["op"] == "test.incr"
    assert span["tags"] == {"x": "bar"}
    assert span["data"]["metric_withspan"] == 1
