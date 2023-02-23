from datetime import datetime

from django.utils import timezone

from sentry.models import Environment, EnvironmentProject, Monitor, MonitorEnvironment
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorEnvironmentTestCase(TestCase):
    def test_monitor_environment(self):
        project = self.project
        environment = Environment.get_or_create(project, "production")

        monitor = Monitor(
            last_checkin=datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc),
            config={"schedule": "* * * * *"},
        )

        production_monitor = MonitorEnvironment(
            monitor=monitor,
            environment_project=EnvironmentProject.objects.get(
                environment=environment, project=project
            ),
        )

        assert type(production_monitor) == MonitorEnvironment
