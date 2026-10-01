"""
Tests for sentry.models.groupopenperiod, focusing on create_open_period correctness.
"""

from datetime import timedelta
from threading import Barrier, Thread

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.models.groupopenperiod import GroupOpenPeriod, create_open_period
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.types.group import PriorityLevel


class CreateOpenPeriodTest(TestCase):
    """Tests for the create_open_period function."""

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(
            type=MetricIssue.type_id,
            priority=PriorityLevel.LOW,
            create_open_period=False,
        )

    def test_creates_open_period(self) -> None:
        """create_open_period should create a GroupOpenPeriod row."""
        start_time = timezone.now()
        create_open_period(self.group, start_time)

        assert GroupOpenPeriod.objects.filter(group=self.group).count() == 1
        period = GroupOpenPeriod.objects.get(group=self.group)
        assert period.date_ended is None
        assert period.date_started == start_time

    def test_no_duplicate_when_open_period_already_exists(self) -> None:
        """
        Calling create_open_period twice while the first period is still open
        must not create a second row.

        This is a regression guard for the TOCTOU race: the in-lock check must
        prevent two concurrent callers from both inserting a row.
        """
        start_time = timezone.now()
        create_open_period(self.group, start_time)

        # Second call — group already has an open (date_ended=None) period.
        second_start = start_time + timedelta(seconds=1)
        create_open_period(self.group, second_start)

        assert GroupOpenPeriod.objects.filter(group=self.group).count() == 1

    def test_creates_new_period_after_previous_closed(self) -> None:
        """After the previous period is closed, a new one should be created."""
        start_time = timezone.now()
        create_open_period(self.group, start_time)

        period = GroupOpenPeriod.objects.get(group=self.group)
        period.close_open_period(resolution_time=start_time + timedelta(minutes=5))

        second_start = start_time + timedelta(minutes=10)
        create_open_period(self.group, second_start)

        assert GroupOpenPeriod.objects.filter(group=self.group).count() == 2
        open_periods = GroupOpenPeriod.objects.filter(group=self.group, date_ended__isnull=True)
        assert open_periods.count() == 1
        assert open_periods.first().date_started == second_start


class CreateOpenPeriodConcurrencyTest(TransactionTestCase):
    """
    Concurrency regression test for create_open_period.

    Two threads call create_open_period simultaneously for the same group.
    Before the fix, both threads could pass the pre-transaction guard and both
    attempt to INSERT, causing an IntegrityError from the
    exclude_overlapping_date_start_end exclusion constraint.
    After the fix, the guard is re-evaluated inside the select_for_update lock,
    so only one row is ever created.
    """

    def test_concurrent_create_open_period_no_integrity_error(self) -> None:
        group = self.create_group(
            type=MetricIssue.type_id,
            priority=PriorityLevel.LOW,
            create_open_period=False,
        )

        start_time = timezone.now()
        errors: list[Exception] = []
        # Use a barrier so both threads reach create_open_period at the same time.
        barrier = Barrier(2, timeout=10)

        def run() -> None:
            try:
                barrier.wait()
                create_open_period(group, start_time)
            except Exception as exc:
                errors.append(exc)

        threads = [Thread(target=run), Thread(target=run)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Unexpected errors from concurrent create_open_period: {errors}"
        assert GroupOpenPeriod.objects.filter(group=group).count() == 1
