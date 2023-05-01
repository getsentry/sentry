from sentry.models import Environment, Project, ScheduledDeletion
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorType,
    ScheduleType,
)
from sentry.tasks.deletion.scheduled import run_deletion
from sentry.testutils import APITestCase, TransactionTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class DeleteMonitorEnvironmentTest(APITestCase, TransactionTestCase):
    def test_simple(self):
        project = self.create_project(name="test")
        env = Environment.objects.create(organization_id=project.organization_id, name="foo")

        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=env,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )

        deletion = ScheduledDeletion.schedule(monitor_env, days=0)
        deletion.update(in_progress=True)

        with self.tasks():
            run_deletion(deletion.id)

        assert not MonitorEnvironment.objects.filter(id=monitor_env.id).exists()
        assert not MonitorCheckIn.objects.filter(id=checkin.id).exists()

        # Shared objects should continue to exist.
        assert Monitor.objects.filter(id=monitor.id).exists()
        assert Environment.objects.filter(id=env.id).exists()
        assert Project.objects.filter(id=project.id).exists()
