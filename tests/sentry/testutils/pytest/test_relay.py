from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field

import pytest
import requests

from sentry.testutils.pytest.relay import RelayNotReadyError, wait_until_ready

URL = "http://relay/api/relay/healthcheck/ready/"


@dataclass
class FakeRelay:
    """A clock plus a readiness endpoint whose answers take simulated time."""

    answers: Iterator[int | requests.RequestException]
    probe_seconds: float = 0.01
    now: float = 0.0
    probe_timeouts: list[float] = field(default_factory=list)
    sleeps: list[float] = field(default_factory=list)

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds

    def probe(self, url: str, *, timeout: float) -> requests.Response:
        assert url == URL
        self.probe_timeouts.append(timeout)
        answer = next(self.answers)
        if isinstance(answer, requests.Timeout):
            self.now += timeout
            raise answer
        self.now += self.probe_seconds
        if isinstance(answer, requests.RequestException):
            raise answer
        response = requests.Response()
        response.status_code = answer
        return response

    def wait(self, timeout: float = 2.0) -> None:
        wait_until_ready(URL, timeout=timeout, clock=self.clock, sleep=self.sleep, probe=self.probe)


def forever(answer: int | requests.RequestException) -> Iterator[int | requests.RequestException]:
    while True:
        yield answer


def test_ready_immediately() -> None:
    relay = FakeRelay(iter([200]))
    relay.wait()
    assert relay.probe_timeouts == [1.0]
    assert relay.sleeps == []


def test_unavailable_then_ready() -> None:
    relay = FakeRelay(iter([503, 503, 200]))
    relay.wait()
    assert len(relay.probe_timeouts) == 3
    assert relay.sleeps == [0.05, 0.05]


def test_connection_error_then_ready() -> None:
    relay = FakeRelay(iter([requests.ConnectionError("refused"), 200]))
    relay.wait()
    assert len(relay.probe_timeouts) == 2


def test_permanently_unavailable() -> None:
    relay = FakeRelay(forever(503))
    with pytest.raises(RelayNotReadyError) as excinfo:
        relay.wait(timeout=2.0)
    assert excinfo.value.last_result == "HTTP 503"
    assert relay.now == pytest.approx(2.0)


def test_request_timeout_is_reported() -> None:
    relay = FakeRelay(forever(requests.Timeout("read timed out")))
    with pytest.raises(RelayNotReadyError) as excinfo:
        relay.wait(timeout=2.5)
    assert excinfo.value.last_result == "Timeout: read timed out"
    # Two full-length probes, then one capped by the 0.4s left after the sleeps.
    assert relay.probe_timeouts == pytest.approx([1.0, 1.0, 0.4])
    assert relay.now == pytest.approx(2.5)


def test_near_deadline_probe_is_capped_and_its_answer_counts() -> None:
    relay = FakeRelay(iter([503, 200]), probe_seconds=1.9)
    relay.wait(timeout=2.0)
    # The second probe starts with 0.05s left and answers after the deadline.
    assert relay.probe_timeouts == pytest.approx([1.0, 0.05])
    assert relay.sleeps == pytest.approx([0.05])
    assert relay.now > 2.0


def test_sleep_never_passes_the_deadline() -> None:
    relay = FakeRelay(forever(503), probe_seconds=1.98)
    with pytest.raises(RelayNotReadyError):
        relay.wait(timeout=2.0)
    assert relay.probe_timeouts == [1.0]
    assert relay.sleeps == pytest.approx([0.02])
