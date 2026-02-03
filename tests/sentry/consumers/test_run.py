from unittest.mock import patch

import pytest
from arroyo.processing.strategies.abstract import ProcessingStrategyFactory

from sentry import consumers
from sentry.conf.types.kafka_definition import ConsumerDefinition
from sentry.utils.imports import import_string


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_all_importable(consumer_def, settings) -> None:
    name: str
    defn: ConsumerDefinition
    name, defn = consumer_def

    factory = import_string(defn["strategy_factory"])
    assert issubclass(factory, ProcessingStrategyFactory)

    topic = defn["topic"]
    assert topic.value in settings.KAFKA_TOPIC_TO_CLUSTER


@pytest.mark.parametrize("consumer_def", list(consumers.KAFKA_CONSUMERS.items()))
def test_dlq(consumer_def) -> None:
    post_process_forwarders = [
        "post-process-forwarder-errors",
        "post-process-forwarder-transactions",
        "post-process-forwarder-issue-platform",
    ]
    subscription_result_consumers = [
        "events-subscription-results",
        "transactions-subscription-results",
        "generic-metrics-subscription-results",
        "metrics-subscription-results",
        "subscription-results-eap-items",
    ]
    consumers_that_should_have_dlq_but_dont = [
        "process-spans",
        "process-segments",
        "ingest-monitors",
        "monitors-clock-tick",
        "monitors-clock-tasks",
        "monitors-incident-occurrences",
        "uptime-results",
        "metrics-last-seen-updater",
        "generic-metrics-last-seen-updater",
        "billing-metrics-consumer",
        "ingest-profiles",
        "ingest-occurrences",
        "ingest-replay-recordings",
        "ingest-replay-recordings-two-step",
    ]

    consumer_name, defn = consumer_def

    if consumer_name not in (
        post_process_forwarders
        + subscription_result_consumers
        + consumers_that_should_have_dlq_but_dont
    ):
        assert defn.get("dlq_topic") is not None, f"{consumer_name} consumer is missing DLQ"


def test_apply_processor_args_overrides() -> None:
    """Test the apply_processor_args_overrides function."""
    from sentry.consumers import apply_processor_args_overrides

    # Test with CLI string overrides
    result = apply_processor_args_overrides(
        "ingest-monitors",
        {"join_timeout": 10.0, "consumer": "mock_consumer", "topic": "mock_topic"},
        ("join_timeout:123", "stuck_detector_timeout:456"),
    )
    assert result["join_timeout"] == 123
    assert result["stuck_detector_timeout"] == 456
    assert result["consumer"] == "mock_consumer"

    # Test with empty overrides
    result = apply_processor_args_overrides("ingest-monitors", {"join_timeout": 10.0}, ())
    assert result["join_timeout"] == 10.0

    # Test logging when overriding existing arg
    with patch("sentry.consumers.logger") as mock_logger:
        result = apply_processor_args_overrides(
            "ingest-monitors",
            {"join_timeout": 10.0},
            ("join_timeout:999",),
        )
        assert result["join_timeout"] == 999
        mock_logger.info.assert_called_once()
        call_args = mock_logger.info.call_args
        assert call_args[0][0] == "overriding argument %s from CLI: %s -> %s"
        assert call_args[0][1] == "join_timeout"
        assert call_args[0][2] == 10.0
        assert call_args[0][3] == 999

    # Test no logging when adding new arg
    with patch("sentry.consumers.logger") as mock_logger:
        result = apply_processor_args_overrides(
            "ingest-monitors",
            {"join_timeout": 10.0},
            ("stuck_detector_timeout:456",),
        )
        assert result["stuck_detector_timeout"] == 456
        mock_logger.info.assert_not_called()

    # Test skipping invalid parameters and logging warning
    with patch("sentry.consumers.logger") as mock_logger:
        result = apply_processor_args_overrides(
            "ingest-monitors",
            {"join_timeout": 10.0},
            ("invalid_param:789", "join_timeout:999"),
        )
        assert result["join_timeout"] == 999
        assert "invalid_param" not in result
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert call_args[0][0] == "skipping invalid argument %s from CLI: %s"
        assert call_args[0][1] == "invalid_param:789"
