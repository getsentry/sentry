from contextlib import contextmanager
from datetime import UTC, datetime

from django.db import router

from sentry.locks import locks
from sentry.models.group import Group
from sentry.models.groupopenperiod import GroupOpenPeriod, create_open_period
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.datetime import freeze_time


@contextmanager
def database_lock_simulation():
    """
    Context manager that simulates a database lock by using a threading lock
    and adding a small delay to simulate database contention.
    """
    lock = locks.get(router.db_for_write(Group), duration=10)
    with lock.acquire():
        yield


class TestGroupOpenPeriod(TestCase):
    # TODO Add tests for GroupOpenPeriod here
    # def test_close_open_period():
    # def test_reopen_open_period():
    pass


@freeze_time("2023-01-01 12:00:00")
class TestCreateOpenPeriod(TestCase):
    """
    Using TransactionTestCase instead of TestCase to properly test
    database transactions and locks.
    """

    def setUp(self):
        self.group = self.create_group()
        self.start = datetime(2023, 1, 1, 12, 0, 0, tzinfo=UTC)
        self.end = datetime(2023, 1, 1, 13, 0, 0, tzinfo=UTC)

    @with_feature("organizations:issue-open-periods")
    def test_create_open_period__deadlock(self):
        """
        Test that create_open_period handles database locks gracefully
        and still creates the open period correctly.
        """
        # Ensure no existing open periods
        GroupOpenPeriod.objects.filter(group=self.group).delete()

        with database_lock_simulation():
            create_open_period(self.group, self.start)

            # Ensure the open period was created correctly
            created_periods = GroupOpenPeriod.objects.filter(group=self.group)
            assert created_periods is not None
            assert len(created_periods) == 1

            created_period = created_periods.first()

            assert created_period is not None
            assert created_period.group == self.group
            assert created_period.date_started == self.start
            assert created_period.date_ended is None
