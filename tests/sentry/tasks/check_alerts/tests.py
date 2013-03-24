import mock
from datetime import timedelta
from django.utils import timezone
from sentry.models import ProjectCountByMinute, Alert
from sentry.tasks.check_alerts import check_project_alerts, check_alerts
from sentry.testutils import TestCase
from sentry.utils.dates import normalize_datetime


class BaseTestCase(TestCase):
    def create_counts(self, when, amount, minute_offset=0, normalize=True):
        date = when - timedelta(minutes=minute_offset)
        if normalize:
            date = normalize_datetime(date)

        ProjectCountByMinute.objects.create(
            project=self.project,
            date=date,
            times_seen=amount,
        )


class CheckAlertsTest(BaseTestCase):
    @mock.patch('sentry.tasks.check_alerts.check_project_alerts')
    def test_does_fire_jobs(self, check_project_alerts):
        when = timezone.now()
        self.create_counts(when, 50, 5, normalize=False)

        with mock.patch('sentry.tasks.check_alerts.timezone.now') as now:
            now.return_value = when
            check_alerts()
            now.assert_called_once_with()

        check_project_alerts.delay.assert_called_once_with(
            project_id=self.project.id,
            when=when - timedelta(minutes=1),
            count=10,
            expires=120
        )


class CheckProjectAlertsTest(BaseTestCase):
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

        # missing a data point, should fail
        check_project_alerts(
            project_id=self.project.id,
            when=now,
            count=100
        )
        assert not Alert.objects.filter(project=self.project).exists()

        self.create_counts(now, 73, 30)  # 15 minutes ago
        check_project_alerts(
            project_id=self.project.id,
            when=now,
            count=100
        )
        assert Alert.objects.filter(project=self.project).exists()
