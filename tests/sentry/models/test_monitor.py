from __future__ import absolute_import, print_function

from datetime import datetime
from django.utils import timezone
from sentry.models import Monitor
from sentry.testutils import TestCase


class MonitorTestCase(TestCase):
    def test_next_run(self):
        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={
                'schedule': '* * * * *',
            }
        )
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 11, tzinfo=timezone.utc)

        monitor.config['schedule'] = '*/5 * * * *'
        assert monitor.get_next_scheduled_checkin() == datetime(2019, 1, 1, 1, 15, tzinfo=timezone.utc)
