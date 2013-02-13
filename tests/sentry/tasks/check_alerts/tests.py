import mock
from datetime import datetime, timedelta
from django.utils import timezone
from sentry.models import ProjectCountByMinute, Alert
from sentry.tasks.check_alerts import check_project_alerts, check_alerts
from sentry.testutils import TestCase
from sentry.utils.dates import normalize_datetime


class CheckAlertsTest(TestCase):
    @mock.patch('sentry.utils.queue.maybe_delay')
    @mock.patch('sentry.app.counter')
    @mock.patch('sentry.tasks.check_alerts.time')
    def test_does_fire_jobs(self, time, counter, maybe_delay):
        time = time.time
        time.return_value = 1360721852.660331

        timestamp = time.return_value - 60
        when = datetime.fromtimestamp(timestamp).replace(tzinfo=timezone.utc)

        counter.extract_counts.return_value = {
            'when': when,
            'results': [
                (str(self.project.id), 57.0),
            ]
        }
        check_alerts()
        time.assert_called_once_with()
        counter.extract_counts.assert_called_once_with(
            prefix='project',
            when=timestamp,
        )
        maybe_delay.assert_called_once_with(
            check_project_alerts,
            project_id=self.project.id,
            when=when,
            count=57,
            expires=120
        )


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
