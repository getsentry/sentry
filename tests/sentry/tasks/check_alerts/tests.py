import mock
from datetime import timedelta
from django.utils import timezone

from sentry.app import tsdb
from sentry.models import Alert
from sentry.tasks.check_alerts import check_project_alerts, check_alerts
from sentry.testutils import TestCase


class BaseTestCase(TestCase):
    def create_counts(self, project, when, amount, offset=0):
        date = when - timedelta(seconds=offset)

        tsdb.incr(tsdb.models.project, project.id, date, amount)


class CheckAlertsTest(BaseTestCase):
    @mock.patch('sentry.tasks.check_alerts.check_project_alerts')
    def test_does_fire_jobs(self, check_project_alerts):
        project = self.create_project()

        check_alerts()

        check_project_alerts.delay.assert_any_call(
            project_id=project.id,
            expires=120
        )


class CheckProjectAlertsTest(BaseTestCase):
    def test_it_works(self):
        project = self.create_project()
        now = timezone.now()

        # create some data with gaps
        for n in range(0, 50, 10):
            self.create_counts(project, now, 2500, n)

        for n in range(50, 300, 10):
            self.create_counts(project, now, 100, n)

        check_project_alerts(
            project_id=project.id,
        )
        assert Alert.objects.filter(project=project).exists()

    def test_without_false_positive(self):
        project = self.create_project()
        now = timezone.now()

        # create some data with gaps
        for n in range(0, 300, 10):
            self.create_counts(project, now, 100, n)

        check_project_alerts(
            project_id=project.id,
        )
        assert not Alert.objects.filter(project=project).exists()

    def test_mostly_empty(self):
        project = self.create_project()
        now = timezone.now()

        # create some data with gaps
        for n in range(0, 100, 10):
            self.create_counts(project, now, 500, n)

        for n in range(100, 280, 10):
            self.create_counts(project, now, 0, n)

        for n in range(280, 300, 10):
            self.create_counts(project, now, 200, n)

        check_project_alerts(
            project_id=project.id,
        )
        assert Alert.objects.filter(project=project).exists()
