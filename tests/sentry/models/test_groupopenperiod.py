from datetime import timedelta

from sentry.incidents.grouptype import MetricIssue
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.testutils.cases import TestCase


class CloseOpenPeriodTest(TestCase):
    def test_closes_at_resolution_time(self) -> None:
        group = self.create_group(type=MetricIssue.type_id)

        open_period = get_latest_open_period(group)
        assert open_period is not None

        resolution_time = open_period.date_started + timedelta(minutes=5)

        open_period.close_open_period(resolution_time=resolution_time)

        open_period.refresh_from_db()
        assert open_period.date_ended == resolution_time

    def test_resolution_before_start_closes_at_start(self) -> None:
        """
        SENTRY-4EDG: a resolution time earlier than date_started must not raise a DataError
        from the tstzrange exclusion constraint. Closing at date_started keeps the period valid.
        """
        group = self.create_group(type=MetricIssue.type_id)

        open_period = get_latest_open_period(group)
        assert open_period is not None

        resolution_time = open_period.date_started - timedelta(milliseconds=7)

        open_period.close_open_period(resolution_time=resolution_time)

        open_period.refresh_from_db()
        assert open_period.date_ended == open_period.date_started
        assert GroupOpenPeriodActivity.objects.filter(
            group_open_period=open_period, type=OpenPeriodActivityType.CLOSED
        ).exists()
