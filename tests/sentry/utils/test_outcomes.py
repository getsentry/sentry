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


def test_track_outcome_default(setup):
    """
    Asserts an outcomes serialization roundtrip with defaults.
    """
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):

        mock_uuid = mock.Mock()
        mock_uuid.hex = "mockeduuid1234567890abcdef"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "mockedhashvalue1234567890abcdef"
        mock_sha256.return_value = mock_hash

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
            "idempotency_key": "mockedhashvalue1234567890abcdef",
        }

        assert outcomes.billing_publisher is None


def test_track_outcome_billing(setup):
    """
    Checks that outcomes are routed to the DEDICATED topic within the same cluster
    in default configuration.
    """
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):

        mock_uuid = mock.Mock()
        mock_uuid.hex = "mockeduuidabcdef1234567890"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "anothermockedhash1234567890"
        mock_sha256.return_value = mock_hash

        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        # Assert that hashlib.sha256 was called with the correct idempotency key fields
        expected_idempotency_key_fields = f"{mock_uuid.hex}|None|1|1|1|{Outcome.ACCEPTED.value}|None|None|1|2021-08-26 17:46:40+00:00"
        mock_sha256.assert_called_with(expected_idempotency_key_fields.encode("utf-8"))

        cluster_args, _ = setup.mock_get_kafka_producer_cluster_options.call_args
        assert cluster_args == (kafka_config.get_topic_definition(Topic.OUTCOMES)["cluster"],)

        assert outcomes.outcomes_publisher
        (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args
        assert topic_name == "outcomes-billing"
        data = json.loads(payload)
        assert data["quantity"] == 1

        assert outcomes.billing_publisher is None


def test_track_outcome_billing_topic(setup):
    """
    Checks that outcomes are routed to the DEDICATED billing topic within the
    same cluster in default configuration.
    """
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):

        mock_uuid = mock.Mock()
        mock_uuid.hex = "uuidforbilling1234567890abcd"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "billinghash1234567890abcd"
        mock_sha256.return_value = mock_hash

        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        # Assert that hashlib.sha256 was called with the correct idempotency key fields
        expected_idempotency_key_fields = f"{mock_uuid.hex}|None|1|1|1|{Outcome.ACCEPTED.value}|None|None|1|2021-08-26 17:46:40+00:00"
        mock_sha256.assert_called_with(expected_idempotency_key_fields.encode("utf-8"))

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
    with (
        mock.patch.dict(settings.KAFKA_TOPIC_TO_CLUSTER, {"outcomes-billing": "different"}),
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):

        mock_uuid = mock.Mock()
        mock_uuid.hex = "billingclusteruuid1234567890"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "billingclusterhash1234567890"
        mock_sha256.return_value = mock_hash

        track_outcome(
            org_id=1,
            project_id=1,
            key_id=1,
            outcome=Outcome.ACCEPTED,
        )

        # Assert that hashlib.sha256 was called with the correct idempotency key fields
        expected_idempotency_key_fields = f"{mock_uuid.hex}|None|1|1|1|{Outcome.ACCEPTED.value}|None|None|1|2021-08-26 17:46:40+00:00"
        mock_sha256.assert_called_with(expected_idempotency_key_fields.encode("utf-8"))

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
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):
        mock_uuid = mock.Mock()
        mock_uuid.hex = "quantityuuid1234567890abcdef"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "quantityhash1234567890abcdef"
        mock_sha256.return_value = mock_hash

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
    Tests that `track_outcome` includes `event_id` in the payload and idempotency key when provided.
    """
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):
        mock_uuid = mock.Mock()
        mock_uuid.hex = "eventiduuid1234567890abcdef"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "eventidhash1234567890abcdef"
        mock_sha256.return_value = mock_hash

        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            event_id="abcdef1234567890abcdef1234567890",
        )

        expected_idempotency_key_fields = f"{mock_uuid.hex}|abcdef1234567890abcdef1234567890|1|2|3|{Outcome.ACCEPTED.value}|None|None|1|2021-08-26 17:46:40+00:00"
        mock_sha256.assert_called_with(expected_idempotency_key_fields.encode("utf-8"))

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
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):
        mock_uuid = mock.Mock()
        mock_uuid.hex = "categoryuuid1234567890abcdef"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "categoryhash1234567890abcdef"
        mock_sha256.return_value = mock_hash

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


def test_track_outcome_idempotency_key(setup):
    """
    Tests that the `idempotency_key` is correctly generated from the inputs.
    """
    with (
        mock.patch("sentry.utils.outcomes.uuid4") as mock_uuid4,
        mock.patch("sentry.utils.outcomes.hashlib.sha256") as mock_sha256,
        mock.patch("time.time", return_value=1630000000),
    ):
        mock_uuid = mock.Mock()
        mock_uuid.hex = "knownuuid1234567890abcdef"
        mock_uuid4.return_value = mock_uuid

        mock_hash = mock.Mock()
        mock_hash.hexdigest.return_value = "knownhash1234567890abcdef"
        mock_sha256.return_value = mock_hash

        event_id = "eventid1234567890abcdef1234567890"
        timestamp = datetime.fromtimestamp(1630000000)
        category = DataCategory.ERROR

        track_outcome(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.RATE_LIMITED,
            reason="reason_test",
            timestamp=timestamp,
            event_id=event_id,
            category=category,
            quantity=2,
        )

        expected_idempotency_key_fields = f"{mock_uuid.hex}|{event_id}|1|2|3|{Outcome.RATE_LIMITED.value}|{category}|reason_test|2|{timestamp}"
        mock_sha256.assert_called_with(expected_idempotency_key_fields.encode("utf-8"))

        (topic_name, payload), _ = setup.mock_publisher.return_value.publish.call_args

        data = json.loads(payload)
        assert data["idempotency_key"] == "knownhash1234567890abcdef"
