import os
from unittest import mock

import pytest
import requests

from sentry.testutils.pytest import relay


class FakeRelay:
    def __init__(self, *answers: int | requests.RequestException) -> None:
        self.answers = list(answers)
        self.now = 0.0
        self.probe_timeouts: list[float] = []

    def get(self, url: str, timeout: float) -> mock.Mock:
        self.probe_timeouts.append(timeout)
        self.now += timeout
        answer = self.answers.pop(0) if len(self.answers) > 1 else self.answers[0]
        if isinstance(answer, Exception):
            raise answer
        return mock.Mock(status_code=answer)

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        assert seconds >= 0
        self.now += seconds

    def wait(self, timeout: float) -> None:
        with (
            mock.patch.object(requests, "get", self.get),
            mock.patch.object(relay, "time", mock.Mock(monotonic=self.monotonic, sleep=self.sleep)),
        ):
            relay._wait_until_ready("http://relay/ready", timeout=timeout)


def test_retries_until_ready() -> None:
    fake = FakeRelay(requests.ConnectionError("refused"), 503, 200)
    fake.wait(timeout=25.5)
    assert len(fake.probe_timeouts) == 3


def test_gives_up_at_deadline_with_last_result() -> None:
    fake = FakeRelay(requests.Timeout("read timed out"))
    with pytest.raises(TimeoutError, match="Timeout: read timed out"):
        fake.wait(timeout=2.5)
    # The last probe is capped by the time left, so the deadline isn't overshot.
    assert fake.probe_timeouts == pytest.approx([1, 1, 0.4])
    assert fake.now == pytest.approx(2.5)


def test_relay_refuses_general_shard() -> None:
    with mock.patch.dict(os.environ, {"BACKEND_TEST_SERVICE_COLOR": "general"}):
        with pytest.raises(RuntimeError, match="general backend shard"):
            relay._require_processing_shard("tests/relay_integration/test_sdk.py::test_simple")


def test_relay_allowed_on_processing_shard() -> None:
    with mock.patch.dict(os.environ, {"BACKEND_TEST_SERVICE_COLOR": "processing"}):
        relay._require_processing_shard("tests/relay_integration/test_sdk.py::test_simple")


def test_relay_allowed_when_uncolored() -> None:
    with mock.patch.dict(os.environ):
        os.environ.pop("BACKEND_TEST_SERVICE_COLOR", None)
        relay._require_processing_shard("tests/relay_integration/test_sdk.py::test_simple")
