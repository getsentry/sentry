from __future__ import annotations

from typing import cast
from unittest import mock
from uuid import uuid4

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_SUCCESS,
    CHECKSTATUSREASONTYPE_TIMEOUT,
)

from sentry.testutils.cases import UptimeTestCase
from sentry.uptime.consumers.tasks import process_uptime_backlog
from sentry.uptime.utils import build_backlog_key, build_last_update_key, get_cluster
from sentry.utils import json


class TestProcessUptimeBacklog(UptimeTestCase):
    def setUp(self):
        super().setUp()
        self.subscription = self.create_uptime_subscription(
            subscription_id=uuid4().hex, interval_seconds=300
        )
        self.detector = self.create_uptime_detector(uptime_subscription=self.subscription)

    def test_empty_queue(self):
        """Task should exit gracefully when queue is empty."""
        cluster = get_cluster()
        task_scheduled_key = f"uptime:backlog_task_scheduled:{self.subscription.id}"

        with mock.patch("sentry.uptime.consumers.tasks.logger") as logger:
            process_uptime_backlog(str(self.subscription.id))
            # Empty queue falls through to "cleared" with processed_count=0
            logger.info.assert_called_with(
                "uptime.backlog.cleared",
                extra={"subscription_id": str(self.subscription.id), "processed_count": 0},
            )

        assert cluster.exists(task_scheduled_key) == 0

    def test_subscription_not_found(self):
        """Task should handle missing subscription gracefully."""
        fake_id = "999999"
        cluster = get_cluster()

        backlog_key = build_backlog_key(fake_id)
        task_scheduled_key = f"uptime:backlog_task_scheduled:{fake_id}"
        result = {
            "guid": uuid4().hex,
            "subscription_id": fake_id,
            "status": CHECKSTATUS_SUCCESS,
            "status_reason": {"type": CHECKSTATUSREASONTYPE_TIMEOUT, "description": "timeout"},
            "trace_id": uuid4().hex,
            "span_id": uuid4().hex,
            "region": "us-west",
            "scheduled_check_time_ms": 1000000000000,
            "actual_check_time_ms": 1000000000000,
            "duration_ms": 100,
            "request_info": None,
        }
        cluster.zadd(
            backlog_key, {json.dumps(result): cast(int, result["scheduled_check_time_ms"])}
        )

        with mock.patch("sentry.uptime.consumers.tasks.logger") as logger:
            process_uptime_backlog(fake_id)
            logger.warning.assert_called_with(
                "uptime.backlog.subscription_not_found", extra={"subscription_id": fake_id}
            )

        assert cluster.exists(backlog_key) == 0
        assert cluster.exists(task_scheduled_key) == 0

    def test_processes_consecutive_results(self):
        """Task should process consecutive results from queue."""
        cluster = get_cluster()
        base_time = 1000000000000
        last_update_key = build_last_update_key(self.detector)
        cluster.set(last_update_key, base_time)
        backlog_key = build_backlog_key(str(self.subscription.id))
        task_scheduled_key = f"uptime:backlog_task_scheduled:{self.subscription.id}"
        result1 = {
            "guid": uuid4().hex,
            "subscription_id": str(self.subscription.id),
            "status": CHECKSTATUS_SUCCESS,
            "status_reason": {"type": CHECKSTATUSREASONTYPE_TIMEOUT, "description": "timeout"},
            "trace_id": uuid4().hex,
            "span_id": uuid4().hex,
            "region": "us-west",
            "scheduled_check_time_ms": base_time + 300000,
            "actual_check_time_ms": base_time + 300000,
            "duration_ms": 100,
            "request_info": None,
        }
        result2 = {
            "guid": uuid4().hex,
            "subscription_id": str(self.subscription.id),
            "status": CHECKSTATUS_SUCCESS,
            "status_reason": {"type": CHECKSTATUSREASONTYPE_TIMEOUT, "description": "timeout"},
            "trace_id": uuid4().hex,
            "span_id": uuid4().hex,
            "region": "us-west",
            "scheduled_check_time_ms": base_time + 600000,
            "actual_check_time_ms": base_time + 600000,
            "duration_ms": 100,
            "request_info": None,
        }
        cluster.zadd(
            backlog_key, {json.dumps(result1): cast(int, result1["scheduled_check_time_ms"])}
        )
        cluster.zadd(
            backlog_key, {json.dumps(result2): cast(int, result2["scheduled_check_time_ms"])}
        )
        with mock.patch("sentry.uptime.consumers.tasks.logger") as logger:
            process_uptime_backlog(str(self.subscription.id))
            logger.info.assert_called_with(
                "uptime.backlog.cleared",
                extra={"subscription_id": str(self.subscription.id), "processed_count": 2},
            )

        assert cluster.zcard(backlog_key) == 0
        assert int(cluster.get(last_update_key) or 0) == base_time + 600000
        assert cluster.exists(task_scheduled_key) == 0

    def test_stops_at_gap(self):
        """Task should stop at gaps and reschedule."""
        cluster = get_cluster()
        base_time = 1000000000000
        last_update_key = build_last_update_key(self.detector)
        cluster.set(last_update_key, base_time)

        backlog_key = build_backlog_key(str(self.subscription.id))
        result1 = {
            "guid": uuid4().hex,
            "subscription_id": str(self.subscription.id),
            "status": CHECKSTATUS_SUCCESS,
            "status_reason": {"type": CHECKSTATUSREASONTYPE_TIMEOUT, "description": "timeout"},
            "trace_id": uuid4().hex,
            "span_id": uuid4().hex,
            "region": "us-west",
            "scheduled_check_time_ms": base_time + 600000,  # +10 minutes (gap!)
            "actual_check_time_ms": base_time + 600000,
            "duration_ms": 100,
            "request_info": None,
        }

        cluster.zadd(
            backlog_key, {json.dumps(result1): cast(int, result1["scheduled_check_time_ms"])}
        )

        # Run task with mocked apply_async to prevent actual rescheduling (lock is managed internally)
        with (
            mock.patch("sentry.uptime.consumers.tasks.logger") as logger,
            mock.patch(
                "sentry.uptime.consumers.tasks.process_uptime_backlog.apply_async"
            ) as mock_apply_async,
        ):
            process_uptime_backlog(str(self.subscription.id), attempt=1)
            logger.info.assert_any_call(
                "uptime.backlog.gap_detected",
                extra={
                    "subscription_id": str(self.subscription.id),
                    "expected_ms": base_time + 300000,
                    "found_ms": base_time + 600000,
                },
            )
            logger.info.assert_any_call(
                "uptime.backlog.rescheduling",
                extra={
                    "subscription_id": str(self.subscription.id),
                    "remaining_items": 1,
                    "attempt": 1,
                    "next_attempt": 2,
                },
            )
            mock_apply_async.assert_called_once()
            call_args, call_kwargs = mock_apply_async.call_args
            assert call_kwargs["args"] == [str(self.subscription.id)]
            assert call_kwargs["countdown"] == 20
            assert call_kwargs["kwargs"]["attempt"] == 2

        assert cluster.zcard(backlog_key) == 1

    def test_uses_detector_state_cache_for_multiple_results(self):
        """
        Test that processing multiple backlog results uses detector state caching
        to avoid N+1 queries.
        """
        from sentry.workflow_engine.models import DetectorState

        cluster = get_cluster()
        base_time = 1000000000000
        last_update_key = build_last_update_key(self.detector)
        cluster.set(last_update_key, base_time)
        backlog_key = build_backlog_key(str(self.subscription.id))

        # Create a detector state
        DetectorState.objects.create(
            detector=self.detector,
            detector_group_key=None,
            is_triggered=False,
            state="0",  # DetectorPriorityLevel.OK
        )

        # Create 5 consecutive results
        results = []
        for i in range(5):
            result = {
                "guid": uuid4().hex,
                "subscription_id": str(self.subscription.id),
                "status": CHECKSTATUS_SUCCESS,
                "status_reason": {
                    "type": CHECKSTATUSREASONTYPE_TIMEOUT,
                    "description": "timeout",
                },
                "trace_id": uuid4().hex,
                "span_id": uuid4().hex,
                "region": "us-west",
                "scheduled_check_time_ms": base_time + (i + 1) * 300000,
                "actual_check_time_ms": base_time + (i + 1) * 300000,
                "duration_ms": 100,
                "request_info": None,
            }
            results.append(result)
            cluster.zadd(
                backlog_key, {json.dumps(result): cast(int, result["scheduled_check_time_ms"])}
            )

        # Process the backlog and count queries
        # Without caching, we'd expect at least 5 DetectorState queries (one per result)
        # With caching, we should only have 1 query for DetectorState
        with self.assertNumQueries(
            # Expected queries:
            # 1. Fetch UptimeSubscription
            # 2. Fetch Detector with prefetch_workflow_data
            # 3. Fetch workflow_condition_group (if exists)
            # 4. Fetch data_conditions (if exists)
            # 5. First DetectorState query (cached for subsequent results)
            # Plus some Redis operations and other ancillary queries
            # The key is that we don't have 5+ DetectorState queries
            num_queries=lambda count: count < 20,  # Should be well under 20 without N+1
            using="default",
        ):
            process_uptime_backlog(str(self.subscription.id))

        # Verify all results were processed
        assert cluster.zcard(backlog_key) == 0
        assert int(cluster.get(last_update_key) or 0) == base_time + 1500000
