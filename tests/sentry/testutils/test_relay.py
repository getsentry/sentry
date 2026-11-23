import time
from collections.abc import Callable, Generator, Iterator
from contextlib import contextmanager
from typing import Any
from unittest import mock

import pytest
from confluent_kafka import Producer
from django.conf import settings

from sentry.constants import DataCategory
from sentry.testutils.pytest import xdist
from sentry.testutils.relay import RelayStoreHelper, _capture_outcomes
from sentry.testutils.skips import requires_kafka
from sentry.utils import json
from sentry.utils.batching_kafka_consumer import create_topics
from sentry.utils.outcomes import Outcome

ORG_ID, PROJECT_ID, KEY_ID = 2, 1, 3


def _outcome(**overrides: object) -> dict[str, Any]:
    return {
        "org_id": ORG_ID,
        "project_id": PROJECT_ID,
        "key_id": KEY_ID,
        "category": DataCategory.ERROR,
        "quantity": 1,
        "outcome": Outcome.FILTERED,
        "reason": "localhost",
        **overrides,
    }


class FakeRelay:
    """Stands in for the HTTP endpoint, the outcomes topic, and the eventstore."""

    def __init__(self) -> None:
        self.outcomes: list[dict[str, Any]] = [_outcome()]
        self.status_code = 200
        self.stored_event: object | None = None

        self.helper = mock.Mock()
        self.helper.project.organization_id = ORG_ID
        self.helper.project.id = PROJECT_ID
        self.helper.projectkey.id = KEY_ID
        self.helper.auth_header = "auth"
        self.helper.get_relay_store_url.return_value = "http://relay/api/1/store/"
        self.helper._rejected_keys = set()
        self.helper.wait_for_ingest_consumer.side_effect = self.wait

    def post(self, url: str, *, headers: object, json: dict[str, Any]) -> mock.Mock:
        resp = mock.Mock(status_code=self.status_code, text="response")
        resp.json.return_value = {"id": json["event_id"]}
        return resp

    @contextmanager
    def capture(self) -> Iterator[Callable[[], dict[str, Any] | None]]:
        pending = iter(self.outcomes)
        yield lambda: next(pending, None)

    def wait(self, predicate: Callable[[], object]) -> object:
        # One poll per queued outcome plus one, instead of a real-time timeout.
        for _ in range(len(self.outcomes) + 1):
            if (result := predicate()) is not None:
                return result
        return None

    def reject(self) -> None:
        RelayStoreHelper.post_and_assert_rejected(
            self.helper, {"message": "hi"}, outcome=Outcome.FILTERED, reason="localhost"
        )


@pytest.fixture
def relay() -> Generator[FakeRelay]:
    fake = FakeRelay()
    with (
        mock.patch("sentry.testutils.relay.responses.add_passthru"),
        mock.patch("sentry.testutils.relay.requests.post", side_effect=fake.post),
        mock.patch("sentry.testutils.relay._capture_outcomes", fake.capture),
        mock.patch("sentry.testutils.relay._get_event", side_effect=lambda *_: fake.stored_event),
    ):
        yield fake


def test_matching_outcome_passes(relay: FakeRelay) -> None:
    relay.reject()


@pytest.mark.parametrize(
    ("field", "value"),
    [("outcome", Outcome.INVALID), ("reason", "web-crawlers"), ("quantity", 2)],
)
def test_unexpected_outcome_fails(relay: FakeRelay, field: str, value: object) -> None:
    relay.outcomes = [_outcome(**{field: value})]
    with pytest.raises(AssertionError):
        relay.reject()


def test_unrelated_outcomes_are_ignored(relay: FakeRelay) -> None:
    relay.outcomes = [
        _outcome(org_id=99, outcome=Outcome.INVALID),
        _outcome(project_id=99, outcome=Outcome.INVALID),
        _outcome(key_id=99, outcome=Outcome.INVALID),
        _outcome(category=DataCategory.ATTACHMENT, outcome=Outcome.INVALID),
        _outcome(),
    ]
    relay.reject()


@pytest.mark.parametrize("outcomes", [[], [_outcome(project_id=99)]])
def test_missing_outcome_fails(relay: FakeRelay, outcomes: list[dict[str, Any]]) -> None:
    relay.outcomes = outcomes
    with pytest.raises(AssertionError, match="no error outcome"):
        relay.reject()


def test_stored_event_fails(relay: FakeRelay) -> None:
    relay.stored_event = object()
    with pytest.raises(AssertionError):
        relay.reject()


def test_http_rejection_fails(relay: FakeRelay) -> None:
    relay.status_code = 403
    with pytest.raises(AssertionError):
        relay.reject()
    relay.helper.wait_for_ingest_consumer.assert_not_called()


def test_second_rejection_for_same_key_fails(relay: FakeRelay) -> None:
    relay.reject()
    with pytest.raises(AssertionError, match="Only one rejection per project key"):
        relay.reject()


@requires_kafka
def test_capture_skips_outcomes_produced_before_it_started() -> None:
    topic = xdist.get_kafka_topic("outcomes")
    producer = Producer(settings.KAFKA_CLUSTERS["default"]["common"])
    marker = time.time_ns()

    def produce(stage: str) -> None:
        producer.produce(topic, json.dumps({"marker": marker, "stage": stage}).encode())
        assert producer.flush(10) == 0

    create_topics("default", [topic])
    produce("before")
    with _capture_outcomes() as poll:
        produce("after")
        seen = []
        deadline = time.monotonic() + 10
        while "after" not in seen and time.monotonic() < deadline:
            if (message := poll()) is not None and message.get("marker") == marker:
                seen.append(message["stage"])

    assert seen == ["after"]
