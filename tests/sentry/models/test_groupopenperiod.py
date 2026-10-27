from datetime import timedelta

from sentry.incidents.grouptype import MetricIssue
from sentry.models.groupopenperiod import create_open_period, get_latest_open_period
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.testutils.cases import TestCase


class CreateOpenPeriodTest(TestCase):
    def test_starts_at_the_requested_time(self) -> None:
        group = self.create_group(type=MetricIssue.type_id)

        previous_open_period = get_latest_open_period(group)
        assert previous_open_period is not None

        resolution_time = previous_open_period.date_started + timedelta(minutes=5)

        previous_open_period.close_open_period(resolution_time=resolution_time)

        start_time = resolution_time + timedelta(minutes=1)

        create_open_period(group, start_time)

        open_period = get_latest_open_period(group)
        assert open_period is not None
        assert open_period.id != previous_open_period.id
        assert open_period.date_started == start_time
        assert open_period.date_ended is None

    def test_starts_right_after_the_previous_open_period_ended(self) -> None:
        """
        Open periods have inclusive bounds and may not overlap. A period whose source reports a
        start before the previous period ended starts immediately after that end instead.
        """
        group = self.create_group(type=MetricIssue.type_id)

        previous_open_period = get_latest_open_period(group)
        assert previous_open_period is not None

        resolution_time = previous_open_period.date_started + timedelta(minutes=5)

        previous_open_period.close_open_period(resolution_time=resolution_time)

        create_open_period(group, resolution_time - timedelta(seconds=7))

        open_period = get_latest_open_period(group)
        assert open_period is not None
        assert open_period.id != previous_open_period.id
        assert open_period.date_started == resolution_time + timedelta(microseconds=1)
        assert open_period.date_ended is None
        assert GroupOpenPeriodActivity.objects.filter(
            group_open_period=open_period, type=OpenPeriodActivityType.OPENED
        ).exists()
