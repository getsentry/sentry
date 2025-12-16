from datetime import datetime, timedelta, timezone
from unittest import mock
from unittest.mock import MagicMock

from sentry.testutils.cases import TestCase
from sentry.uptime.tasks import write_pending_missed_checks
from sentry.uptime.utils import build_backfilled_miss_key, build_pending_misses_key, get_cluster
from sentry.utils import json


class WritePendingMissedChecksTest(TestCase):
    def setUp(self):
        super().setUp()
        self.subscription = self.create_uptime_subscription()
        self.detector = self.create_uptime_detector(uptime_subscription=self.subscription)
        self.cluster = get_cluster()

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_writes_pending_misses(self, mock_produce: MagicMock) -> None:
        """Test that pending misses are written to EAP when their write time has passed."""
        with self.feature("organizations:uptime-upgrade-late-results"):
            # Create a pending miss
            scheduled_time_ms = int(
                (datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp() * 1000
            )
            miss_result = {
                "guid": "test-guid",
                "subscription_id": str(self.subscription.subscription_id),
                "status": "missed_window",
                "status_reason": None,
                "trace_id": "test-trace-id",
                "span_id": "test-span-id",
                "region": "us-west",
                "scheduled_check_time_ms": scheduled_time_ms,
                "actual_check_time_ms": scheduled_time_ms + 1000,
                "duration_ms": 0,
                "request_info": None,
            }

            # Store miss data
            backfill_key = build_backfilled_miss_key(self.detector, scheduled_time_ms)
            self.cluster.set(backfill_key, json.dumps(miss_result), ex=timedelta(minutes=5))

            # Add backfill key to sorted set with write time in the past
            write_time_ms = (datetime.now(timezone.utc) - timedelta(seconds=10)).timestamp() * 1000
            self.cluster.zadd(build_pending_misses_key(), {backfill_key: write_time_ms})

            # Run the task
            write_pending_missed_checks()

            # Verify miss was written to EAP
            assert mock_produce.call_count == 1

            # Verify cleanup
            assert self.cluster.get(backfill_key) is None
            assert self.cluster.zscore(build_pending_misses_key(), backfill_key) is None

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_skips_future_misses(self, mock_produce: MagicMock) -> None:
        """Test that misses with write time in the future are not written yet."""
        with self.feature("organizations:uptime-upgrade-late-results"):
            # Create a pending miss with write time in the future
            scheduled_time_ms = int(
                (datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp() * 1000
            )
            miss_result = {
                "guid": "test-guid",
                "subscription_id": str(self.subscription.subscription_id),
                "status": "missed_window",
                "status_reason": None,
                "trace_id": "test-trace-id",
                "span_id": "test-span-id",
                "region": "us-west",
                "scheduled_check_time_ms": scheduled_time_ms,
                "actual_check_time_ms": scheduled_time_ms + 1000,
                "duration_ms": 0,
                "request_info": None,
            }

            # Store miss data
            backfill_key = build_backfilled_miss_key(self.detector, scheduled_time_ms)
            self.cluster.set(backfill_key, json.dumps(miss_result), ex=timedelta(minutes=5))

            # Add backfill key to sorted set with future write time
            write_time_ms = (datetime.now(timezone.utc) + timedelta(minutes=2)).timestamp() * 1000
            self.cluster.zadd(build_pending_misses_key(), {backfill_key: write_time_ms})

            # Run the task
            write_pending_missed_checks()

            # Verify miss was NOT written to EAP
            assert mock_produce.call_count == 0

            # Verify data still exists
            assert self.cluster.get(backfill_key) is not None
            assert self.cluster.zscore(build_pending_misses_key(), backfill_key) is not None

    @mock.patch("sentry.uptime.consumers.eap_producer._eap_items_producer.produce")
    def test_handles_missing_backfill_key(self, mock_produce: MagicMock) -> None:
        """Test that task handles case where backfill key is missing (late result already handled it)."""
        with self.feature("organizations:uptime-upgrade-late-results"):
            # Create sorted set entry but NO backfill key (simulates late result upgrading the miss)
            scheduled_time_ms = int(
                (datetime.now(timezone.utc) - timedelta(minutes=10)).timestamp() * 1000
            )
            backfill_key = build_backfilled_miss_key(self.detector, scheduled_time_ms)

            # Add to sorted set with write time in the past, but don't create the backfill key
            write_time_ms = (datetime.now(timezone.utc) - timedelta(seconds=10)).timestamp() * 1000
            self.cluster.zadd(build_pending_misses_key(), {backfill_key: write_time_ms})

            # Run the task
            write_pending_missed_checks()

            # Verify nothing was written to EAP
            assert mock_produce.call_count == 0

            # Verify cleanup still happened
            assert self.cluster.zscore(build_pending_misses_key(), backfill_key) is None
