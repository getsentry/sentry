from unittest.mock import MagicMock, patch

import pytest
from confluent_kafka import KafkaError, KafkaException
from sentry_kafka_schemas import SchemaNotFound

from sentry.utils.batching_kafka_consumer import create_topics


@patch("sentry.utils.batching_kafka_consumer.wait_for_topics")
@patch("sentry.utils.batching_kafka_consumer.AdminClient")
def test_create_topics_creates_missing_topics(
    mock_admin_client: MagicMock, mock_wait_for_topics: MagicMock
) -> None:
    admin_client = mock_admin_client.return_value
    admin_client.create_topics.return_value = {"events": MagicMock()}

    create_topics(
        "default",
        ["events"],
        topic_creation_configs={"events": (4, {"retention.ms": "1000"})},
    )

    new_topics = admin_client.create_topics.call_args.args[0]
    assert len(new_topics) == 1
    assert new_topics[0].topic == "events"
    assert new_topics[0].num_partitions == 4
    assert new_topics[0].replication_factor == 1
    assert new_topics[0].config == {"retention.ms": "1000"}
    mock_wait_for_topics.assert_called_once_with(admin_client, ["events"])


@patch("sentry.utils.batching_kafka_consumer.wait_for_topics")
@patch("sentry.utils.batching_kafka_consumer.AdminClient")
@patch("sentry.utils.batching_kafka_consumer.get_topic", side_effect=SchemaNotFound)
def test_create_topics_falls_back_for_topics_without_a_schema(
    mock_get_topic: MagicMock,
    mock_admin_client: MagicMock,
    mock_wait_for_topics: MagicMock,
) -> None:
    admin_client = mock_admin_client.return_value
    admin_client.create_topics.return_value = {"custom-topic": MagicMock()}

    create_topics("default", ["custom-topic"])

    new_topics = admin_client.create_topics.call_args.args[0]
    assert new_topics[0].num_partitions == 1
    assert new_topics[0].config == {}
    mock_wait_for_topics.assert_called_once_with(admin_client, ["custom-topic"])


@patch("sentry.utils.batching_kafka_consumer.wait_for_topics")
@patch("sentry.utils.batching_kafka_consumer.AdminClient")
def test_create_topics_ignores_existing_topics(
    mock_admin_client: MagicMock, mock_wait_for_topics: MagicMock
) -> None:
    admin_client = mock_admin_client.return_value
    future = MagicMock()
    future.result.side_effect = KafkaException(KafkaError(KafkaError.TOPIC_ALREADY_EXISTS))
    admin_client.create_topics.return_value = {"events": future}

    create_topics("default", ["events"])

    mock_wait_for_topics.assert_called_once_with(admin_client, ["events"])


@patch("sentry.utils.batching_kafka_consumer.wait_for_topics")
@patch("sentry.utils.batching_kafka_consumer.AdminClient")
def test_create_topics_propagates_other_errors(
    mock_admin_client: MagicMock, mock_wait_for_topics: MagicMock
) -> None:
    admin_client = mock_admin_client.return_value
    future = MagicMock()
    future.result.side_effect = KafkaException(KafkaError(KafkaError.INVALID_CONFIG))
    admin_client.create_topics.return_value = {"events": future}

    with pytest.raises(KafkaException):
        create_topics("default", ["events"])

    mock_wait_for_topics.assert_not_called()


@patch("sentry.utils.batching_kafka_consumer.AdminClient")
def test_create_topics_with_no_topics_does_not_connect(
    mock_admin_client: MagicMock,
) -> None:
    create_topics("default", [])

    mock_admin_client.assert_not_called()
