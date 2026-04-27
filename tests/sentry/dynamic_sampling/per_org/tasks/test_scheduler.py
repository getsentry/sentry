from __future__ import annotations

from unittest.mock import patch

from sentry.dynamic_sampling.per_org.tasks.scheduler import schedule_per_org_calculations
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
        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert dispatched == []

    @override_options({"dynamic-sampling.per_org.rollout-rate": 0.0})
    def test_does_not_scan_when_rollout_zero(self) -> None:
        self.create_organization()

        with (
            patch(
                "sentry.dynamic_sampling.per_org.tasks.scheduler.RangeQuerySetWrapper"
            ) as wrapper,
            BurstTaskRunner() as burst,
        ):
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        wrapper.assert_not_called()
        assert dispatched == []

    @override_options({"dynamic-sampling.per_org.rollout-rate": 1.0})
    def test_dispatches_active_orgs(self) -> None:
        active = self.create_organization()
        pending_deletion = self.create_organization()
        pending_deletion.status = OrganizationStatus.PENDING_DELETION
        pending_deletion.save()

        with BurstTaskRunner() as burst:
            schedule_per_org_calculations()
            dispatched = _drain_dispatched_org_ids(burst)

        assert active.id in dispatched
        assert pending_deletion.id not in dispatched
