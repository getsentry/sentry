from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorEnvironmentTestCase(TestCase):
    def test_monitor_environment(self):
        # Commenting out until we get MonitorEnvironment DB into a stable state
        # project = self.project
        # environment = Environment.get_or_create(project, "production")
        #
        # monitor = Monitor.objects.create(
        #     organization_id=self.organization.id,
        #     project_id=self.project.id,
        #     type=MonitorType.CRON_JOB,
        #     config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        # )
        #
        # production_monitor = MonitorEnvironment.objects.create(
        #     monitor=monitor, environment=environment
        # )
        #
        # assert type(production_monitor) == MonitorEnvironment
        pass
