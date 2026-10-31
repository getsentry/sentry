from unittest import mock

import pytest
import requests

from sentry.testutils.pytest import relay
from sentry.testutils.relay import RelayStoreHelper


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


@pytest.mark.parametrize(
    ("status", "stored"),
    [(200, False), (200, True), (403, False)],
)
def test_negative_relay_helper_requires_accepted_request_and_absent_event(
    status: int, stored: bool
) -> None:
    helper = mock.Mock()
    helper.project.id = 1
    helper.auth_header = "auth"
    url = "http://relay/api/1/store/"
    helper.get_relay_store_url.return_value = url
    helper.wait_for_ingest_consumer.side_effect = lambda predicate: predicate()

    event_id = "1234567890abcdef1234567890abcdef"
    resp = mock.Mock(status_code=status, text="response")
    resp.json.return_value = {"id": event_id}
    event = object() if stored else None
    with (
        mock.patch("sentry.testutils.relay.uuid4", return_value=mock.Mock(hex=event_id)),
        mock.patch("sentry.testutils.relay.responses.add_passthru"),
        mock.patch("sentry.testutils.relay.requests.post", return_value=resp) as post,
        mock.patch(
            "sentry.testutils.relay.eventstore.backend.get_event_by_id", return_value=event
        ),
    ):
        if stored or status != 200:
            with pytest.raises(AssertionError):
                RelayStoreHelper.post_and_assert_not_stored(helper, {"message": "test"})
        else:
            RelayStoreHelper.post_and_assert_not_stored(helper, {"message": "test"})
        post.assert_called_once_with(
            url,
            headers={"x-sentry-auth": "auth", "content-type": "application/json"},
            json={"message": "test", "event_id": event_id},
        )
