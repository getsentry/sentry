import types
from datetime import datetime
from unittest import mock

import pytest

from sentry.conf.types.kafka_definition import Topic
from sentry.constants import DataCategory
from sentry.utils import json, kafka_config, outcomes
from sentry.utils.outcomes import Outcome, track_outcome


@pytest.fixture(autouse=True)
def setup():
    # Rely on the fact that the publisher is initialized lazily
    with mock.patch.object(kafka_config, "get_kafka_producer_cluster_options") as mck_get_options:
        with mock.patch.object(outcomes, "KafkaPublisher") as mck_publisher:
            # Reset internals of the outcomes module
            with mock.patch.object(outcomes, "outcomes_publisher", None):
                with mock.patch.object(outcomes, "billing_publisher", None):
                    yield types.SimpleNamespace(
                        mock_get_kafka_producer_cluster_options=mck_get_options,
                        mock_publisher=mck_publisher,
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
def test_outcome_is_billing(outcome: Outcome, is_billing: bool):
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
def test_parse_outcome(name, outcome):
    """
    Asserts *case insensitive* parsing of outcomes from their canonical names,
    as used in the API and queries.
    """
    assert Outcome.parse(name) == outcome


def test_outcome_parse_invalid_name():
    """
    Tests that `Outcome.parse` raises a KeyError for invalid outcome names.
    """
    with pytest.raises(KeyError):
        Outcome.parse("nonexistent_outcome")


def test_track_outcome_default(setup):
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

    cluster_args, _ = setup.mock_get_kafka_producer_cluster_options.call_args
    assert cluster_args == (kafka_config.get_topic_definition(Topic.OUTCOMES)["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args

    # not billing because it's not accepted/rate limited
    assert topic_name == "outcomes"

    data = json.loads(payload)
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

    assert outcomes.billing_publisher is None


def test_track_outcome_billing(setup):
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

    cluster_args, _ = setup.mock_get_kafka_producer_cluster_options.call_args
    assert cluster_args == (kafka_config.get_topic_definition(Topic.OUTCOMES)["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, _), _ = setup.mock_publisher.return_value.publish.call_args
    assert topic_name == "outcomes-billing"

    assert outcomes.billing_publisher is None


def test_track_outcome_billing_topic(setup):
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

    cluster_args, _ = setup.mock_get_kafka_producer_cluster_options.call_args
    assert cluster_args == (kafka_config.get_topic_definition(Topic.OUTCOMES)["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, _), _ = setup.mock_publisher.return_value.publish.call_args
    assert topic_name == "outcomes-billing"

    assert outcomes.billing_publisher is None


def test_track_outcome_billing_cluster(settings, setup):
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

        cluster_args, _ = setup.mock_get_kafka_producer_cluster_options.call_args
        assert cluster_args == ("different",)

        assert outcomes.billing_publisher
        (topic_name, _), _ = setup.mock_publisher.return_value.publish.call_args
        assert topic_name == "outcomes-billing"

        assert outcomes.outcomes_publisher is None


def test_outcome_api_name():
    """
    Tests that the `api_name` method returns the lowercase name of the outcome.
    """
    for outcome in Outcome:
        assert outcome.api_name() == outcome.name.lower()


def test_track_outcome_with_quantity(setup):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args

    data = json.loads(payload)
    assert data["quantity"] == 5


def test_track_outcome_with_event_id(setup):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args

    data = json.loads(payload)
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
def test_track_outcome_with_category(setup, category):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args

    data = json.loads(payload)
    assert data["category"] == category.value


def test_track_outcome_with_invalid_inputs():
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


def test_track_outcome_with_provided_timestamp(setup):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
    data = json.loads(payload)
    assert data["timestamp"] == "2021-01-01T12:00:00.000000Z"


def test_track_outcome_with_none_key_id(setup):
    """
    Tests that `track_outcome` handles `key_id=None` correctly in the payload.
    """
    track_outcome(
        org_id=1,
        project_id=2,
        key_id=None,
        outcome=Outcome.FILTERED,
    )

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
    data = json.loads(payload)
    assert data["key_id"] is None


def test_track_outcome_with_none_reason(setup):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
    data = json.loads(payload)
    assert data["reason"] is None


def test_track_outcome_with_none_category(setup):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
    data = json.loads(payload)
    assert data["category"] is None


@pytest.mark.parametrize("quantity", [0, -1, -100])
def test_track_outcome_with_non_positive_quantity(setup, quantity):
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

    (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
    data = json.loads(payload)
    assert data["quantity"] == quantity


def test_metrics_incr_called_with_correct_tags(setup):
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


def test_track_outcome_publisher_initialization(setup):
    """
    Tests that the publisher is correctly initialized when clusters are the same.
    """
    # Ensure publishers are None
    outcomes.outcomes_publisher = None
    outcomes.billing_publisher = None

    # Trigger track_outcome to initialize the publisher
    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    # Since outcome is billing but clusters are the same, outcomes_publisher should be initialized
    assert outcomes.billing_publisher is None
    assert outcomes.outcomes_publisher is not None


def test_track_outcome_publisher_initialization_different_cluster(settings, setup):
    """
    Tests that the publisher is correctly initialized when clusters are different.
    """
    # Ensure publishers are None
    outcomes.outcomes_publisher = None
    outcomes.billing_publisher = None

    # Simulate different clusters for 'outcomes' and 'outcomes-billing' topics
    cluster_patch = {"outcomes-billing": "different_cluster", "outcomes": "default_cluster"}
    with mock.patch.dict(settings.KAFKA_TOPIC_TO_CLUSTER, cluster_patch):
        # Trigger track_outcome to initialize the publisher
        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        # Since outcome is billing and clusters are different, billing_publisher should be initialized
        assert outcomes.billing_publisher is not None
        assert outcomes.outcomes_publisher is None  # type: ignore[unreachable]

        # Reset publishers
        outcomes.outcomes_publisher = None
        outcomes.billing_publisher = None

        # Trigger track_outcome to initialize the publisher for non-billing outcomes
        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.FILTERED,
        )

        assert outcomes.billing_publisher is None
        assert outcomes.outcomes_publisher is not None
