from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.environment import Environment
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    ScheduleType,
)
from sentry.testutils.cases import APITestCase, TransactionTestCase
from sentry.testutils.hybrid_cloud import HybridCloudTestMixin


class DeleteMonitorCheckInTest(APITestCase, TransactionTestCase, HybridCloudTestMixin):
    def test_delete_monitor_checkin_with_incidents_and_detections(self) -> None:
        """
        Test that deleting MonitorCheckIns properly cascades to:
        - MonitorIncidents (via starting_checkin_id and resolving_checkin_id)
        - MonitorEnvBrokenDetection (via MonitorIncident)

        This tests the get_child_relations_bulk() implementation which should:
        1. Use __in queries for MonitorIncidents pointing to multiple check-ins
        2. Bulk delete MonitorEnvBrokenDetection via BulkModelDeletionTask
        """
        project = self.create_project(name="test")
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")

        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=env.id,
        )

        # Create multiple check-ins to test bulk deletion
        checkin1 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )
        checkin2 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )
        checkin3 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.OK,
        )

        # Create incidents - one starting with checkin1, resolving with checkin3
        incident1 = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            starting_checkin=checkin1,
            resolving_checkin=checkin3,
        )

        # Create another incident - starting with checkin2, not yet resolved
        incident2 = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            starting_checkin=checkin2,
            resolving_checkin=None,
        )

        # Create MonitorEnvBrokenDetection pointing to incidents
        detection1 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident1,
        )
        detection2 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident2,
        )

        # Verify initial state
        assert MonitorCheckIn.objects.filter(monitor=monitor).count() == 3
        assert MonitorIncident.objects.filter(monitor=monitor).count() == 2
        assert MonitorEnvBrokenDetection.objects.count() == 2

        # Schedule monitor for deletion (which should cascade to check-ins)
        self.ScheduledDeletion.schedule(instance=monitor, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify everything is deleted
        assert not Monitor.objects.filter(id=monitor.id).exists()
        assert not MonitorEnvironment.objects.filter(id=monitor_env.id).exists()
        assert not MonitorCheckIn.objects.filter(
            id__in=[checkin1.id, checkin2.id, checkin3.id]
        ).exists()
        assert not MonitorIncident.objects.filter(id__in=[incident1.id, incident2.id]).exists()
        assert not MonitorEnvBrokenDetection.objects.filter(
            id__in=[detection1.id, detection2.id]
        ).exists()

        # Shared objects should continue to exist
        assert Environment.objects.filter(id=env.id).exists()
        assert self.project.__class__.objects.filter(id=self.project.id).exists()

    def test_delete_multiple_checkins_with_shared_incident(self) -> None:
        """
        Test edge case where one incident references multiple check-ins
        (starting_checkin != resolving_checkin from the same batch).
        """
        project = self.create_project(name="test")
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")

        monitor = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=env.id,
        )

        # Create check-ins
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )
        ok_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.OK,
        )

        # Create incident that references BOTH check-ins
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            starting_checkin=failed_checkin,
            resolving_checkin=ok_checkin,
        )

        detection = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident,
        )

        # Schedule monitor for deletion
        self.ScheduledDeletion.schedule(instance=monitor, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify complete deletion
        assert not MonitorCheckIn.objects.filter(id__in=[failed_checkin.id, ok_checkin.id]).exists()
        assert not MonitorIncident.objects.filter(id=incident.id).exists()
        assert not MonitorEnvBrokenDetection.objects.filter(id=detection.id).exists()

    def test_delete_monitor_only_affects_its_own_checkins(self) -> None:
        """
        Test that deleting one monitor's check-ins doesn't affect another monitor's data.
        This verifies that the __in queries are properly scoped.
        """
        project = self.create_project(name="test")
        env = Environment.objects.create(organization_id=project.organization_id, name="prod")

        # Create first monitor with check-ins and incidents
        monitor1 = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            name="Monitor 1",
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env1 = MonitorEnvironment.objects.create(
            monitor=monitor1,
            environment_id=env.id,
        )
        checkin1_m1 = MonitorCheckIn.objects.create(
            monitor=monitor1,
            monitor_environment=monitor_env1,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )
        checkin2_m1 = MonitorCheckIn.objects.create(
            monitor=monitor1,
            monitor_environment=monitor_env1,
            project_id=project.id,
            status=CheckInStatus.OK,
        )
        incident1_m1 = MonitorIncident.objects.create(
            monitor=monitor1,
            monitor_environment=monitor_env1,
            starting_checkin=checkin1_m1,
            resolving_checkin=checkin2_m1,
        )
        detection1_m1 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident1_m1,
        )

        # Create second monitor with check-ins and incidents
        monitor2 = Monitor.objects.create(
            organization_id=project.organization.id,
            project_id=project.id,
            name="Monitor 2",
            config={"schedule": "0 * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_env2 = MonitorEnvironment.objects.create(
            monitor=monitor2,
            environment_id=env.id,
        )
        checkin1_m2 = MonitorCheckIn.objects.create(
            monitor=monitor2,
            monitor_environment=monitor_env2,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )
        checkin2_m2 = MonitorCheckIn.objects.create(
            monitor=monitor2,
            monitor_environment=monitor_env2,
            project_id=project.id,
            status=CheckInStatus.OK,
        )
        incident1_m2 = MonitorIncident.objects.create(
            monitor=monitor2,
            monitor_environment=monitor_env2,
            starting_checkin=checkin1_m2,
            resolving_checkin=checkin2_m2,
        )
        detection1_m2 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident1_m2,
        )

        # Verify initial state - both monitors exist with their data
        assert MonitorCheckIn.objects.count() == 4
        assert MonitorIncident.objects.count() == 2
        assert MonitorEnvBrokenDetection.objects.count() == 2

        # Delete only monitor1
        self.ScheduledDeletion.schedule(instance=monitor1, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify monitor1 and its data are deleted
        assert not Monitor.objects.filter(id=monitor1.id).exists()
        assert not MonitorEnvironment.objects.filter(id=monitor_env1.id).exists()
        assert not MonitorCheckIn.objects.filter(id__in=[checkin1_m1.id, checkin2_m1.id]).exists()
        assert not MonitorIncident.objects.filter(id=incident1_m1.id).exists()
        assert not MonitorEnvBrokenDetection.objects.filter(id=detection1_m1.id).exists()

        # Verify monitor2 and ALL its data still exist (unaffected)
        assert Monitor.objects.filter(id=monitor2.id).exists()
        assert MonitorEnvironment.objects.filter(id=monitor_env2.id).exists()
        assert MonitorCheckIn.objects.filter(id=checkin1_m2.id).exists()
        assert MonitorCheckIn.objects.filter(id=checkin2_m2.id).exists()
        assert MonitorIncident.objects.filter(id=incident1_m2.id).exists()
        assert MonitorEnvBrokenDetection.objects.filter(id=detection1_m2.id).exists()

        # Verify counts - should only have monitor2's data remaining
        assert MonitorCheckIn.objects.count() == 2
        assert MonitorIncident.objects.count() == 1
        assert MonitorEnvBrokenDetection.objects.count() == 1
