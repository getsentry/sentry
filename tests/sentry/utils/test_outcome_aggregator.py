from typing import int
from unittest import mock

import pytest

from sentry.constants import DataCategory
from sentry.utils import json
from sentry.utils.outcomes import Outcome, OutcomeAggregator


@pytest.fixture(autouse=True)
def setup():
    with mock.patch("sentry.utils.kafka_config.get_kafka_producer_cluster_options"):
        with mock.patch("sentry.utils.outcomes.KafkaPublisher") as mck_publisher:
            with mock.patch("sentry.utils.outcomes.outcomes_publisher", None):
                with mock.patch("sentry.utils.outcomes.billing_publisher", None):
                    yield mck_publisher


def test_basic_aggregation(setup):
    aggregator = OutcomeAggregator(
        bucket_interval=10, flush_interval=5, max_batch_size=100, jitter=0
    )

    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
        quantity=5,
    )
    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
        quantity=3,
    )

    aggregator.flush(force=True)

    assert setup.return_value.publish.call_count == 1
    (_, payload), _ = setup.return_value.publish.call_args
    data = json.loads(payload)
    assert data["quantity"] == 8


def test_different_keys_not_aggregated(setup):
    aggregator = OutcomeAggregator(
        bucket_interval=10, flush_interval=5, max_batch_size=100, jitter=0
    )

    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
        quantity=1,
    )
    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.FILTERED,
        category=DataCategory.ERROR,
        quantity=1,
    )

    aggregator.flush(force=True)

    assert setup.return_value.publish.call_count == 2


def test_flush_on_buffer_size(setup):
    aggregator = OutcomeAggregator(
        bucket_interval=10, flush_interval=60, max_batch_size=2, jitter=0
    )

    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=1,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
        quantity=1,
    )
    aggregator.track_outcome_aggregated(
        org_id=1,
        project_id=2,
        key_id=3,
        outcome=Outcome.ACCEPTED,
        category=DataCategory.ERROR,
        quantity=1,
    )

    assert setup.return_value.publish.call_count == 2


def test_flush_on_time_interval(setup):
    base_time = 1000

    with mock.patch("time.time", return_value=base_time):
        aggregator = OutcomeAggregator(
            bucket_interval=1, flush_interval=2, max_batch_size=100, jitter=0
        )

        aggregator.track_outcome_aggregated(
            org_id=1,
            project_id=2,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            category=DataCategory.ERROR,
            quantity=1,
        )

    assert setup.return_value.publish.call_count == 0

    with mock.patch("time.time", return_value=base_time + 3):
        aggregator.track_outcome_aggregated(
            org_id=1,
            project_id=3,
            key_id=3,
            outcome=Outcome.ACCEPTED,
            category=DataCategory.ERROR,
            quantity=1,
        )

    assert setup.return_value.publish.call_count >= 1


def test_jitter_applied(setup):
    # Test that jitter is applied when not explicitly set
    base_time = 1000

    with mock.patch("time.time", return_value=base_time):
        with mock.patch("random.randint", return_value=30):
            aggregator = OutcomeAggregator(
                bucket_interval=10, flush_interval=60, max_batch_size=100
            )

            # The last flush time should be adjusted by jitter
            # last_flush_time = current_time + jitter
            # = 1000 + 30 = 1030
            assert aggregator._last_flush_time == 1030

    # Test that explicit jitter value is used
    with mock.patch("time.time", return_value=base_time):
        aggregator = OutcomeAggregator(
            bucket_interval=10, flush_interval=60, max_batch_size=100, jitter=45
        )
        # last_flush_time = 1000 + 45 = 1045
        assert aggregator._last_flush_time == 1045

    # Test that jitter=0 behaves as before
    with mock.patch("time.time", return_value=base_time):
        aggregator = OutcomeAggregator(
            bucket_interval=10, flush_interval=60, max_batch_size=100, jitter=0
        )
        # last_flush_time = 1000 + 0 = 1000 (same as before, no jitter)
        assert aggregator._last_flush_time == 1000
