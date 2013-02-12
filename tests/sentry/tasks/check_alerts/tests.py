from datetime import timedelta
from django.utils import timezone
from sentry.models import ProjectCountByMinute
from sentry.tasks.check_alerts import check_project_alerts
from sentry.testutils import TestCase
from sentry.utils.dates import normalize_datetime


class CheckProjectAlertsTest(TestCase):
    def create_counts(self, when, amount, minute_offset=0):
        ProjectCountByMinute.objects.create(
            project=self.project,
            date=normalize_datetime(when - timedelta(minutes=minute_offset)),
            times_seen=amount,
        )

    def test_it_works(self):
        now = timezone.now()

        # create some data with gaps
        self.create_counts(now, 50)  # just now
        self.create_counts(now, 73, 15)  # 15 minutes ago
        self.create_counts(now, 100, 45)  # 45 minutes ago
        self.create_counts(now, 90, 60)  # 60 minutes ago
        self.create_counts(now, 95, 75)  # 75 minutes ago
        self.create_counts(now, 130, 90)  # 90 minutes ago
        self.create_counts(now, 150, 105)  # 105 minutes ago
        self.create_counts(now, 100, 120)  # 120 minutes ago

        # the 45 minute interval should be ignored and the
        # 30 minute interval should be normalized to the 15 minute interval
        can_alert = check_project_alerts(
            project_id=self.project.id,
            name='total',
            when=now,
            count=15
        )
        assert can_alert is False

        self.create_counts(now, 73, 30)  # 15 minutes ago
        can_alert = check_project_alerts(
            project_id=self.project.id,
            name='total',
            when=now,
            count=15
        )
        assert can_alert is True
