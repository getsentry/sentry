import types
from unittest import mock

import pytest

from sentry.conf.types.kafka_definition import Topic
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
