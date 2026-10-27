from collections.abc import Callable, Generator
from contextlib import contextmanager
from typing import cast
from unittest import mock

import pytest
import requests
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.types import Topic

from sentry.testutils.pytest import relay
from sentry.testutils.relay import RelayStoreHelper
from sentry.utils import json as json_utils
from sentry.utils.outcomes import Outcome

type OutcomePayload = dict[str, int | str]
type RejectionCase = tuple[mock.Mock, list[OutcomePayload], requests.Response, mock.Mock]


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


@pytest.fixture
def rejection_case() -> Generator[RejectionCase]:
    broker = LocalBroker(MemoryMessageStorage[KafkaPayload]())
    topic = Topic("outcomes")
    broker.create_topic(topic, 1)
    producer = broker.get_producer()
    consumer = broker.get_consumer("relay-rejection-test")
    consumer.subscribe([topic])

    helper = mock.Mock()
    helper.project.id = 1
    helper.project.organization_id = 2
    helper.projectkey.id = 3
    helper.auth_header = "auth"
    helper.get_relay_store_url.return_value = "http://relay/api/1/store/"

    outcomes: list[OutcomePayload] = [
        {
            "org_id": 2,
            "project_id": 1,
            "key_id": 3,
            "category": 1,
            "quantity": 1,
            "outcome": Outcome.FILTERED,
            "reason": "localhost",
        }
    ]
    response = requests.Response()
    response.status_code = 200

    def post(url: str, *, headers: dict[str, str], json: dict[str, object]) -> requests.Response:
        for outcome in outcomes:
            producer.produce(
                topic, KafkaPayload(None, json_utils.dumps(outcome).encode(), [])
            ).result()
        response._content = json_utils.dumps({"id": json["event_id"]}).encode()
        return response

    @contextmanager
    def capture() -> Generator[Callable[[], OutcomePayload | None]]:
        def poll() -> OutcomePayload | None:
            message = consumer.poll(0)
            return (
                cast(OutcomePayload, json_utils.loads(message.payload.value))
                if message is not None
                else None
            )

        try:
            yield poll
        finally:
            consumer.close()

    def wait(predicate: Callable[[], OutcomePayload | None]) -> OutcomePayload | None:
        # Exercise the helper's filtering without a real-time timeout or services.
        for _ in range(len(outcomes) + 1):
            result = predicate()
            if result is not None:
                return result
        return None

    helper.capture_relay_outcomes.side_effect = capture
    helper.wait_for_ingest_consumer.side_effect = wait
    with (
        mock.patch("sentry.testutils.relay.requests.post", side_effect=post),
        mock.patch(
            "sentry.testutils.relay.eventstore.backend.get_event_by_id", return_value=None
        ) as event_query,
    ):
        yield helper, outcomes, response, event_query


def test_rejection_ignores_foreign_and_unscoped_outcomes(rejection_case: RejectionCase) -> None:
    helper, outcomes, _, event_query = rejection_case
    outcomes[:0] = [
        {"project_id": 99},
        {"org_id": 2, "project_id": 1},
        {"org_id": 2, "project_id": 1, "key_id": 99},
        {"org_id": 99, "project_id": 1, "key_id": 3},
    ]
    RelayStoreHelper.post_and_assert_rejected(
        helper, {}, outcome=Outcome.FILTERED, reason="localhost"
    )
    event_query.assert_called_once()


@pytest.mark.parametrize(
    ("field", "value"),
    [("outcome", Outcome.ACCEPTED), ("reason", "web-crawlers"), ("category", 2), ("quantity", 2)],
)
def test_rejection_requires_the_expected_outcome(
    rejection_case: RejectionCase, field: str, value: int | str
) -> None:
    helper, outcomes, _, event_query = rejection_case
    outcomes[0][field] = value
    with pytest.raises(AssertionError):
        RelayStoreHelper.post_and_assert_rejected(
            helper, {}, outcome=Outcome.FILTERED, reason="localhost"
        )
    event_query.assert_not_called()


def test_rejection_timeout_is_a_failure(rejection_case: RejectionCase) -> None:
    helper, outcomes, _, event_query = rejection_case
    outcomes.clear()
    with pytest.raises(AssertionError, match="No Relay outcome"):
        RelayStoreHelper.post_and_assert_rejected(
            helper, {}, outcome=Outcome.FILTERED, reason="localhost"
        )
    event_query.assert_not_called()


def test_rejection_requires_the_cold_async_path(rejection_case: RejectionCase) -> None:
    helper, _, response, event_query = rejection_case
    response.status_code = 403
    with pytest.raises(AssertionError):
        RelayStoreHelper.post_and_assert_rejected(
            helper, {}, outcome=Outcome.FILTERED, reason="localhost"
        )
    helper.wait_for_ingest_consumer.assert_not_called()
    event_query.assert_not_called()


def test_rejection_fails_if_the_event_was_ingested(rejection_case: RejectionCase) -> None:
    helper, _, _, event_query = rejection_case
    event_query.return_value = object()
    with pytest.raises(AssertionError):
        RelayStoreHelper.post_and_assert_rejected(
            helper, {}, outcome=Outcome.FILTERED, reason="localhost"
        )
    event_query.assert_called_once()
