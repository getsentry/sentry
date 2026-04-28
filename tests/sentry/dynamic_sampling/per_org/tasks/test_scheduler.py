from __future__ import annotations

from unittest.mock import call, patch

from sentry.dynamic_sampling.per_org.tasks.scheduler import (
    BUCKET_COUNT,
    BUCKET_CURSOR_KEY,
    JITTER_WINDOW_SECONDS,
    _next_bucket_index,
    run_calculations_per_org,
    schedule_per_org_calculations,
    schedule_per_org_calculations_bucket,
)
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BEAT_STATUS_METRIC,
    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
    SCHEDULER_BUCKET_SIZE_METRIC,
    SCHEDULER_BUCKET_STATUS_METRIC,
    TelemetryStatus,
)
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner

_BUCKET_TASK_NAME = "sentry.dynamic_sampling.per_org.schedule_per_org_calculations_bucket"


def _drain_dispatched_org_ids(burst) -> list[int]:
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


def _is_bucket_task(task) -> bool:
    return getattr(task, "name", None) == _BUCKET_TASK_NAME


class SchedulePerOrgCalculationsTest(TestCase):
    def create_orgs_across_buckets(self, per_bucket: int = 2) -> dict[int, list[int]]:
        by_bucket: dict[int, list[int]] = {bucket: [] for bucket in range(BUCKET_COUNT)}
        for _ in range(BUCKET_COUNT * per_bucket * 20):
            if all(len(ids) >= per_bucket for ids in by_bucket.values()):
                break
            org = self.create_organization()
            by_bucket[org.id % BUCKET_COUNT].append(org.id)
        assert all(len(ids) >= per_bucket for ids in by_bucket.values())
        return by_bucket

    @override_options(
        {
            "dynamic-sampling.per_org.killswitch": True,
            "dynamic-sampling.per_org.rollout-rate": 1.0,
        }
    )
    def test_is_noop_when_killswitch_engaged(self) -> None:
        with (
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_status") as emit_status,
        ):
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []
        emit_status.assert_called_once_with(
            SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.KILLSWITCHED
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_does_not_scan_when_rollout_zero(self) -> None:
        self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.RangeQuerySetWrapper"
            ) as wrapper,
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_status") as emit_status,
        ):
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        wrapper.assert_not_called()
        assert dispatched == []
        emit_status.assert_called_once_with(
            SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.ROLLOUT_DISABLED
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_queues_next_bucket(self) -> None:
        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler._next_bucket_index",
                return_value=4,
            ),
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_status") as emit_status,
        ):
            schedule_per_org_calculations()

        assert len(burst.queue) == 1
        task, args, kwargs = burst.queue[0]
        assert _is_bucket_task(task)
        assert args == (4,)
        assert kwargs == {}
        emit_status.assert_called_once_with(
            SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.DISPATCHED
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_bucket_dispatches_only_orgs_in_target_bucket(self) -> None:
        by_bucket = self.create_orgs_across_buckets(per_bucket=2)
        target = 3

        with (
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.random.randint", return_value=7),
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_status") as emit_status,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_gauge") as emit_gauge,
        ):
            schedule_per_org_calculations_bucket(target)
            dispatched = _drain_dispatched_org_ids(burst)

        for org_id in dispatched:
            assert org_id % BUCKET_COUNT == target
        for org_id in by_bucket[target]:
            assert org_id in dispatched
        for bucket, org_ids in by_bucket.items():
            if bucket == target:
                continue
            for org_id in org_ids:
                assert org_id not in dispatched
        assert len(dispatched) >= len(by_bucket[target])
        assert JITTER_WINDOW_SECONDS > 0
        emit_gauge.assert_called_once_with(
            SCHEDULER_BUCKET_SIZE_METRIC,
            len(dispatched),
            tags={"bucket_index": str(target)},
        )
        emit_status.assert_has_calls(
            [
                call(
                    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
                    TelemetryStatus.DISPATCHED,
                    amount=len(dispatched),
                    extra_tags={"bucket_index": str(target)},
                ),
                call(
                    SCHEDULER_BUCKET_ORG_STATUS_METRIC,
                    TelemetryStatus.ROLLOUT_EXCLUDED,
                    amount=0,
                    extra_tags={"bucket_index": str(target)},
                ),
                call(
                    SCHEDULER_BUCKET_STATUS_METRIC,
                    TelemetryStatus.COMPLETED,
                    extra_tags={"bucket_index": str(target)},
                ),
            ]
        )

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_bucket_skips_inactive_orgs(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with (
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.random.randint", return_value=0),
        ):
            for bucket in range(BUCKET_COUNT):
                schedule_per_org_calculations_bucket(bucket)
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched


class NextBucketIndexTest(TestCase):
    def test_uses_redis_cursor(self) -> None:
        class FakeRedis:
            value = 0

            def incr(self, key: str) -> int:
                assert key == BUCKET_CURSOR_KEY
                self.value += 1
                return self.value

        redis = FakeRedis()

        with patch(
            "sentry.dynamic_sampling.per_org.tasks.scheduler.get_redis_client_for_ds",
            return_value=redis,
        ):
            observed = [_next_bucket_index() for _ in range(BUCKET_COUNT + 2)]

        assert observed == [index % BUCKET_COUNT for index in range(BUCKET_COUNT + 2)]


class RunCalculationsPerOrgTest(TestCase):
    def test_emits_not_in_rollout_without_completed_status(self) -> None:
        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.is_killswitch_engaged"
            ) as is_killswitch_engaged,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.is_org_in_rollout"
            ) as is_org_in_rollout,
            patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer"),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics_sample_rate",
                return_value=1.0,
            ),
            patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit_status,
        ):
            is_killswitch_engaged.return_value = False
            is_org_in_rollout.return_value = False

            assert run_calculations_per_org(1) == TelemetryStatus.NOT_IN_ROLLOUT

        emit_status.assert_called_once_with(
            "dynamic_sampling.run_calculations_per_org.status",
            TelemetryStatus.NOT_IN_ROLLOUT,
        )

    def test_emits_no_dynamic_sampling_without_completed_status(self) -> None:
        organization = self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.is_killswitch_engaged"
            ) as is_killswitch_engaged,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.is_org_in_rollout"
            ) as is_org_in_rollout,
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.has_dynamic_sampling"
            ) as has_dynamic_sampling,
            patch("sentry.dynamic_sampling.per_org.tasks.telemetry.metrics.timer"),
            patch(
                "sentry.dynamic_sampling.per_org.tasks.telemetry.metrics_sample_rate",
                return_value=1.0,
            ),
            patch("sentry.dynamic_sampling.per_org.tasks.telemetry.emit_status") as emit_status,
        ):
            is_killswitch_engaged.return_value = False
            is_org_in_rollout.return_value = True
            has_dynamic_sampling.return_value = False

            assert (
                run_calculations_per_org(organization.id)
                == TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING
            )

        emit_status.assert_called_once_with(
            "dynamic_sampling.run_calculations_per_org.status",
            TelemetryStatus.ORG_HAS_NO_DYNAMIC_SAMPLING,
        )
