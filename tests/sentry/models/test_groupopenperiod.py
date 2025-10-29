from datetime import timedelta

from django.utils import timezone

from sentry.incidents.grouptype import MetricIssue
from sentry.models.activity import Activity
from sentry.models.groupopenperiod import GroupOpenPeriod, create_open_period
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class CloseOpenPeriodTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project, type=MetricIssue.type_id)

        # Create an open period
        self.start_time = timezone.now() - timedelta(hours=2)
        create_open_period(self.group, self.start_time)
        open_period = GroupOpenPeriod.objects.filter(group=self.group).first()
        assert open_period is not None
        assert open_period.date_ended is None
        self.open_period = open_period

    def test_close_open_period_resolution_time_before_start_time(self) -> None:
        """
        Test that when resolution_time is before date_started, we use current time
        as the close time. This prevents DataError from PostgreSQL range constraint.
        Since open periods track Sentry's internal view of when issues are open,
        using current time is more accurate than creating a zero-duration period.
        """
        # Resolution time is 3 hours before the start time (problematic)
        resolution_time = self.start_time - timedelta(hours=3)
        activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.SET_RESOLVED.value,
            user_id=self.user.id,
        )

        before_close = timezone.now()
        self.open_period.close_open_period(
            resolution_activity=activity,
            resolution_time=resolution_time,
        )
        after_close = timezone.now()

        # Should use current time as the close time, not the provided resolution_time
        self.open_period.refresh_from_db()
        assert self.open_period.date_ended is not None
        assert self.open_period.date_ended != resolution_time
        assert self.open_period.date_ended >= self.start_time
        # Verify it's approximately now (within the test execution window)
        assert before_close <= self.open_period.date_ended <= after_close
        assert self.open_period.resolution_activity == activity
        assert self.open_period.user_id == self.user.id
