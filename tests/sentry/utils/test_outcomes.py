import types
from datetime import datetime, timedelta
from unittest import mock

import pytest

from sentry.constants import DataCategory
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils import json, outcomes
from sentry.utils.outcomes import Outcome, track_outcome


@pytest.fixture(autouse=True)
def setup():
    with mock.patch.object(outcomes.outcomes_producer, "produce") as mck_outcomes:
        with mock.patch.object(outcomes.billing_producer, "produce") as mck_billing:
            yield types.SimpleNamespace(
                mock_outcomes_produce=mck_outcomes,
                mock_billing_produce=mck_billing,
            )


@pytest.mark.parametrize(
    "outcome, is_billing",
    [
        (Outcome.ACCEPTED, True),
        (Outcome.FILTERED, False),
        (Outcome.RATE_LIMITED, True),
        (Outcome.INVALID, False),
        (Outcome.ABUSE, False),
        (Outcome.CLIENT_DISCARD, False),
        (Outcome.CARDINALITY_LIMITED, False),
    ],
)
def test_outcome_is_billing(outcome: Outcome, is_billing: bool) -> None:
    """
    Tests the complete behavior of ``is_billing``, used for routing outcomes to
    different Kafka topics. This is more of a sanity check to prevent
    unintentional changes.
    """
    assert outcome.is_billing() is is_billing


@pytest.mark.parametrize(
    "name, outcome",
    [
        ("rate_limited", Outcome.RATE_LIMITED),
        ("RATE_LIMITED", Outcome.RATE_LIMITED),
    ],
)
def test_parse_outcome(name: str, outcome: Outcome) -> None:
    """
    Asserts *case insensitive* parsing of outcomes from their canonical names,
    as used in the API and queries.
    """
    assert Outcome.parse(name) == outcome


def test_outcome_parse_invalid_name() -> None:
    """
    Tests that `Outcome.parse` raises a KeyError for invalid outcome names.
    """
    with pytest.raises(KeyError):
        Outcome.parse("nonexistent_outcome")


def test_track_outcome_default(setup) -> None:
    """
    Asserts an outcomes serialization roundtrip with defaults.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.INVALID,
        reason="project_id",
    )

    setup.mock_billing_produce.assert_not_called()
    (arroyo_topic, kafka_payload), _ = setup.mock_outcomes_produce.call_args

    # not billing because it's not accepted/rate limited
    assert arroyo_topic.name == "outcomes"

    data = json.loads(kafka_payload.value)
    del data["timestamp"]
    assert data == {
        "org_id": 1,
        "project_id": 2,
        "key_id": 3,
        "outcome": Outcome.INVALID.value,
        "reason": "project_id",
        "event_id": None,
        "category": None,
        "quantity": 1,
    }


def test_track_outcome_billing(setup) -> None:
    """
    Checks that outcomes are routed to the DEDICATED topic within the same cluster
    in default configuration.
    """

    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    setup.mock_billing_produce.assert_not_called()
    (arroyo_topic, _), _ = setup.mock_outcomes_produce.call_args
    assert arroyo_topic.name == "outcomes-billing"


def test_track_outcome_billing_topic(setup) -> None:
    """
    Checks that outcomes are routed to the DEDICATED billing topic within the
    same cluster in default configuration.
    """
    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    setup.mock_billing_produce.assert_not_called()
    (arroyo_topic, _), _ = setup.mock_outcomes_produce.call_args
    assert arroyo_topic.name == "outcomes-billing"


def test_track_outcome_billing_cluster(settings, setup) -> None:
    """
    Checks that outcomes are routed to the dedicated cluster and topic.
    """

    with mock.patch.dict(settings.KAFKA_TOPIC_TO_CLUSTER, {"outcomes-billing": "different"}):
        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        setup.mock_outcomes_produce.assert_not_called()
        (arroyo_topic, _), _ = setup.mock_billing_produce.call_args
        assert arroyo_topic.name == "outcomes-billing"


def test_outcome_api_name() -> None:
    """
    Tests that the `api_name` method returns the lowercase name of the outcome.
    """
    for outcome in Outcome:
        assert outcome.api_name() == outcome.name.lower()


def test_track_outcome_with_quantity(setup) -> None:
    """
    Tests that `track_outcome` handles different `quantity` values correctly.
    """

    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.FILTERED,
        reason="spam",
        quantity=5,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args

    data = json.loads(kafka_payload.value)
    assert data["quantity"] == 5


def test_track_outcome_with_event_id(setup) -> None:
    """
    Tests that `track_outcome` includes `event_id` in the payload.
    """

    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        event_id="abcdef1234567890abcdef1234567890",
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args

    data = json.loads(kafka_payload.value)
    assert data["event_id"] == "abcdef1234567890abcdef1234567890"


@pytest.mark.parametrize(
    "category",
    [
        DataCategory.ERROR,
        DataCategory.TRANSACTION,
        DataCategory.SECURITY,
        DataCategory.ATTACHMENT,
        DataCategory.DEFAULT,
    ],
)
def test_track_outcome_with_category(setup, category: DataCategory) -> None:
    """
    Tests that `track_outcome` correctly includes different `category` values in the payload.
    """

    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=category,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args

    data = json.loads(kafka_payload.value)
    assert data["category"] == category.value


def test_track_outcome_with_invalid_inputs() -> None:
    """
    Tests that `track_outcome` raises AssertionError when invalid inputs are provided.
    """
    with pytest.raises(AssertionError):
        track_outcome(
            # Should be int
            org_id="invalid_org_id",  # type: ignore[arg-type]
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
        )

    with pytest.raises(AssertionError):
        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            # Should be Outcome instance
            outcome="invalid_outcome",  # type: ignore[arg-type]
        )

    with pytest.raises(AssertionError):
        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            # Should be DataCategory or None
            category="invalid_category",  # type: ignore[arg-type]
        )


def test_track_outcome_with_provided_timestamp(setup) -> None:
    """
    Tests that `track_outcome` uses the provided `timestamp` instead of the current time.
    """
    provided_timestamp = datetime(2021, 1, 1, 12, 0, 0)

    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        timestamp=provided_timestamp,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args
    data = json.loads(kafka_payload.value)
    assert data["timestamp"] == "2021-01-01T12:00:00.000000Z"


def test_track_outcome_late(setup) -> None:
    """
    Tests that we emit metrics when an outcome is later than 1 day.
    """
    mock_date = datetime(2021, 1, 1, 12, 0, 0)
    with freeze_time(mock_date), mock.patch("sentry.utils.metrics.incr") as mock_metrics_incr:
        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            timestamp=mock_date - timedelta(days=1, microseconds=1),
        )

        mock_metrics_incr.assert_has_calls(
            [
                mock.call(
                    "events.outcomes.late",
                    skip_internal=True,
                    tags={
                        "outcome": "accepted",
                        "reason": None,
                        "category": "null",
                        "topic": "outcomes-billing",
                    },
                ),
                mock.call(
                    "events.outcomes",
                    skip_internal=True,
                    tags={
                        "outcome": "accepted",
                        "reason": None,
                        "category": "null",
                        "topic": "outcomes-billing",
                    },
                ),
            ],
        )


def test_track_outcome_with_none_key_id(setup) -> None:
    """
    Tests that `track_outcome` handles `key_id=None` correctly in the payload.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=None,
        outcome=Outcome.FILTERED,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args
    data = json.loads(kafka_payload.value)
    assert data["key_id"] is None


def test_track_outcome_with_none_reason(setup) -> None:
    """
    Tests that `track_outcome` handles `reason=None` correctly in the payload.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.RATE_LIMITED,
        reason=None,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args
    data = json.loads(kafka_payload.value)
    assert data["reason"] is None


def test_track_outcome_with_none_category(setup) -> None:
    """
    Tests that `track_outcome` handles `category=None` correctly in the payload.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=None,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args
    data = json.loads(kafka_payload.value)
    assert data["category"] is None


@pytest.mark.parametrize("quantity", [0, -1, -100])
def test_track_outcome_with_non_positive_quantity(setup, quantity: int) -> None:
    """
    Tests that `track_outcome` handles non-positive `quantity` values.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.INVALID,
        quantity=quantity,
    )

    (_, kafka_payload), _ = setup.mock_outcomes_produce.call_args
    data = json.loads(kafka_payload.value)
    assert data["quantity"] == quantity


def test_metrics_incr_called_with_correct_tags(setup) -> None:
    """
    Tests that `metrics.incr` is called with the correct arguments.
    """
    with mock.patch("sentry.utils.metrics.incr") as mock_metrics_incr:
        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            reason="test_reason",
            category=DataCategory.ERROR,
        )

        mock_metrics_incr.assert_called_once_with(
            "events.outcomes",
            skip_internal=True,
            tags={
                "outcome": "accepted",
                "reason": "test_reason",
                "category": "error",
                "topic": "outcomes-billing",
            },
        )


def test_track_outcome_routes_to_outcomes_producer(setup) -> None:
    """
    When the billing and outcomes topics share a cluster, billing outcomes
    are routed through the outcomes producer (to the billing topic name).
    """
    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    setup.mock_outcomes_produce.assert_called_once()
    setup.mock_billing_produce.assert_not_called()


def test_track_outcome_routes_to_billing_producer_when_clusters_differ(settings, setup) -> None:
    """
    When the billing topic lives on a different cluster from the outcomes
    topic, billing outcomes use the billing producer and non-billing outcomes
    continue to use the outcomes producer.
    """
    cluster_patch = {"outcomes-billing": "different_cluster", "outcomes": "default_cluster"}
    with mock.patch.dict(settings.KAFKA_TOPIC_TO_CLUSTER, cluster_patch):
        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        setup.mock_billing_produce.assert_called_once()
        setup.mock_outcomes_produce.assert_not_called()

        setup.mock_billing_produce.reset_mock()
        setup.mock_outcomes_produce.reset_mock()

        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.FILTERED,
        )

        setup.mock_outcomes_produce.assert_called_once()
        setup.mock_billing_produce.assert_not_called()
