from typing import Any, Dict

import pytest
from sentry_sdk import Client, Hub, Transport

from sentry.metrics.minimetrics import MiniMetricsMetricsBackend, have_minimetrics
from sentry.testutils.helpers import override_options


def parse_metrics(bytes: bytes):
    rv = []
    for line in bytes.splitlines():
        pieces = line.decode("utf-8").split("|")
        payload = pieces[0].split(":")
        name = payload[0]
        values = payload[1:]
        ty = pieces[1]
        ts = None
        tags: Dict[str, Any] = {}
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

    def get_metrics(self):
        result = []
        for envelope in self.captured:
            for item in envelope.items:
                if item.headers.get("type") == "statsd":
                    result.extend(parse_metrics(item.payload.get_bytes()))
        result.sort(key=lambda x: (x[0], x[1], x[2]))
        return result


@pytest.fixture(scope="function")
def hub():
    hub = Hub(
        Client(
            dsn="http://foo@example.invalid/42",
            transport=DummyTransport,
            _experiments={
                "enable_metrics": True,
            },
        )
    )
    with hub:
        yield hub


@pytest.fixture(scope="function")
def backend():
    return MiniMetricsMetricsBackend(prefix="sentrytest.")


@pytest.mark.skipif(not have_minimetrics, reason="no minimetrics")
@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
    }
)
def test_incr_called_with_no_tags(backend, hub):
    backend.incr(key="foo", tags={"x": "y"})
    hub.client.flush()

    metrics = hub.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "c"
    assert metrics[0][3] == ["1.0"]
    assert metrics[0][4]["release"] != ""
    assert metrics[0][4]["environment"] != ""
    assert metrics[0][4]["x"] == "y"

    assert len(hub.client.metrics_aggregator.buckets) == 0


@pytest.mark.skipif(not have_minimetrics, reason="no minimetrics")
@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
    }
)
def test_incr_called_with_tag_value_as_list(backend, hub):
    # The minimetrics backend supports the list type.
    backend.incr(key="foo", tags={"x": ["bar", "baz"]})
    hub.client.flush()

    metrics = hub.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][4]["x"] == ["bar", "baz"]

    assert len(hub.client.metrics_aggregator.buckets) == 0


@pytest.mark.skipif(not have_minimetrics, reason="no minimetrics")
@override_options(
    {
        "delightful_metrics.enable_capture_envelope": True,
    }
)
def test_gauge_as_counter(backend, hub):
    # The minimetrics backend supports the list type.
    backend.gauge(key="foo", value=42.0)
    hub.client.flush()

    metrics = hub.client.transport.get_metrics()

    assert len(metrics) == 1
    assert metrics[0][1] == "sentrytest.foo@none"
    assert metrics[0][2] == "c"
    assert metrics[0][3] == ["42.0"]

    assert len(hub.client.metrics_aggregator.buckets) == 0
