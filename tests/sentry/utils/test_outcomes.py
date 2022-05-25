import copy
from unittest.mock import Mock

import pytest

from sentry.utils import json, kafka_config, outcomes
from sentry.utils.outcomes import Outcome, track_outcome


@pytest.fixture(autouse=True)
def setup(monkeypatch, settings):
    # Rely on the fact that the publisher is initialized lazily
    monkeypatch.setattr(kafka_config, "get_kafka_producer_cluster_options", Mock())
    monkeypatch.setattr(outcomes, "KafkaPublisher", Mock())

    # Reset internals of the outcomes module
    monkeypatch.setattr(outcomes, "outcomes_publisher", None)
    monkeypatch.setattr(outcomes, "billing_publisher", None)

    # Settings fixture does not restore nested mutable attributes
    settings.KAFKA_TOPICS = copy.deepcopy(settings.KAFKA_TOPICS)


@pytest.mark.parametrize(
    "outcome, is_billing",
    [
        (Outcome.ACCEPTED, True),
        (Outcome.FILTERED, False),
        (Outcome.RATE_LIMITED, True),
        (Outcome.INVALID, False),
        (Outcome.ABUSE, False),
        (Outcome.CLIENT_DISCARD, False),
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


def test_track_outcome_default(settings):
    """
    Asserts an outcomes serialization roundtrip with defaults.

    Additionally checks that non-billing outcomes are routed to the DEFAULT
    outcomes cluster and topic, even if there is a separate cluster for billing
    outcomes.
    """

    # Provide a billing cluster config that should be ignored
    settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES_BILLING] = {"cluster": "different"}

    track_outcome(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.INVALID,
        reason="project_id",
    )

    cluster_args, _ = kafka_config.get_kafka_producer_cluster_options.call_args
    assert cluster_args == (settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, payload), _ = outcomes.outcomes_publisher.publish.call_args
    assert topic_name == settings.KAFKA_OUTCOMES

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


def test_track_outcome_billing(settings):
    """
    Checks that outcomes are routed to the SHARED topic within the same cluster
    in default configuration.
    """

    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    cluster_args, _ = kafka_config.get_kafka_producer_cluster_options.call_args
    assert cluster_args == (settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, _), _ = outcomes.outcomes_publisher.publish.call_args
    assert topic_name == settings.KAFKA_OUTCOMES

    assert outcomes.billing_publisher is None


def test_track_outcome_billing_topic(settings):
    """
    Checks that outcomes are routed to the DEDICATED billing topic within the
    same cluster in default configuration.
    """

    settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES_BILLING] = {
        "cluster": settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]["cluster"],
    }

    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    cluster_args, _ = kafka_config.get_kafka_producer_cluster_options.call_args
    assert cluster_args == (settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES]["cluster"],)

    assert outcomes.outcomes_publisher
    (topic_name, _), _ = outcomes.outcomes_publisher.publish.call_args
    assert topic_name == settings.KAFKA_OUTCOMES_BILLING

    assert outcomes.billing_publisher is None


def test_track_outcome_billing_cluster(settings):
    """
    Checks that outcomes are routed to the dedicated cluster and topic.
    """

    settings.KAFKA_TOPICS[settings.KAFKA_OUTCOMES_BILLING] = {"cluster": "different"}

    track_outcome(
        org_id=1,
        project_id=1,
        key_id=1,
        outcome=Outcome.ACCEPTED,
    )

    cluster_args, _ = kafka_config.get_kafka_producer_cluster_options.call_args
    assert cluster_args == ("different",)

    assert outcomes.billing_publisher
    (topic_name, _), _ = outcomes.billing_publisher.publish.call_args
    assert topic_name == settings.KAFKA_OUTCOMES_BILLING

    assert outcomes.outcomes_publisher is None
