from __future__ import annotations

from unittest.mock import call, patch

from sentry.dynamic_sampling.per_org.tasks.scheduler import (
    run_calculations_per_org,
    schedule_per_org_calculations,
)
from sentry.dynamic_sampling.per_org.tasks.telemetry import (
    SCHEDULER_BEAT_ORG_STATUS_METRIC,
    SCHEDULER_BEAT_STATUS_METRIC,
    TelemetryStatus,
)
from sentry.models.organization import OrganizationStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.helpers.task_runner import BurstTaskRunner


def _drain_dispatched_org_ids(burst) -> list[int]:
    ids = [args[0] for _task, args, _kwargs in burst.queue]
    burst.queue.clear()
    return ids


class SchedulePerOrgCalculationsTest(TestCase):
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
    def test_dispatches_active_orgs(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with (
            BurstTaskRunner() as burst,
            patch("sentry.dynamic_sampling.per_org.tasks.scheduler.emit_status") as emit_status,
        ):
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched
        emit_status.assert_has_calls(
            [
                call(SCHEDULER_BEAT_STATUS_METRIC, TelemetryStatus.COMPLETED),
                call(SCHEDULER_BEAT_ORG_STATUS_METRIC, TelemetryStatus.DISPATCHED, amount=1),
                call(SCHEDULER_BEAT_ORG_STATUS_METRIC, TelemetryStatus.ROLLOUT_EXCLUDED, amount=0),
            ]
        )


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
