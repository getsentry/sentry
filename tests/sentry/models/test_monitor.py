from __future__ import absolute_import, print_function

from datetime import datetime
from django.utils import timezone
from sentry.models import Monitor, ScheduleType
from sentry.testutils import TestCase


class MonitorTestCase(TestCase):
    def test_next_run_crontab_implicit(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={
                'schedule': '* * * * *',
            }
        )
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 11, tzinfo=timezone.utc)

        monitor.config['schedule'] = '*/5 * * * *'
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 15, tzinfo=timezone.utc)

    def test_next_run_crontab_explicit(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={
                'schedule': '* * * * *',
                'schedule_type': ScheduleType.CRONTAB,
            }
        )
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 11, tzinfo=timezone.utc)

        monitor.config['schedule'] = '*/5 * * * *'
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 15, tzinfo=timezone.utc)

    def test_next_run_interval(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={
                'schedule': [1, 'month'],
                'schedule_type': ScheduleType.INTERVAL,
            }
        )
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 2, 1, 1, 10, 20, tzinfo=timezone.utc)
