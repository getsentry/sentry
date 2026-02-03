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

    def test_delete_checkin_directly(self) -> None:
        """
        Test that deleting a MonitorCheckIn directly (not via Monitor deletion)
        properly handles MonitorIncident children via MonitorCheckInDeletionTask.
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
            status=CheckInStatus.OK,
        )
        checkin3 = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            project_id=project.id,
            status=CheckInStatus.ERROR,
        )

        # Create incidents referencing checkin1
        incident1 = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            starting_checkin=checkin1,
            resolving_checkin=checkin2,
        )
        incident2 = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_env,
            starting_checkin=checkin3,
            resolving_checkin=checkin1,  # checkin1 is also a resolving checkin
        )

        detection1 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident1,
        )
        detection2 = MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident2,
        )

        # Verify initial state
        assert MonitorCheckIn.objects.count() == 3
        assert MonitorIncident.objects.count() == 2
        assert MonitorEnvBrokenDetection.objects.count() == 2

        # Delete checkin1 directly (not via Monitor)
        self.ScheduledDeletion.schedule(instance=checkin1, days=0)

        with self.tasks():
            run_scheduled_deletions()

        # Verify checkin1 is deleted
        assert not MonitorCheckIn.objects.filter(id=checkin1.id).exists()

        # Verify both incidents are deleted (incident1 has checkin1 as starting_checkin,
        # incident2 has checkin1 as resolving_checkin)
        assert not MonitorIncident.objects.filter(id=incident1.id).exists()
        assert not MonitorIncident.objects.filter(id=incident2.id).exists()

        # Verify detections are deleted
        assert not MonitorEnvBrokenDetection.objects.filter(id=detection1.id).exists()
        assert not MonitorEnvBrokenDetection.objects.filter(id=detection2.id).exists()

        # Verify other check-ins still exist
        assert MonitorCheckIn.objects.filter(id=checkin2.id).exists()
        assert MonitorCheckIn.objects.filter(id=checkin3.id).exists()
        assert MonitorCheckIn.objects.count() == 2

        # Verify monitor and environment still exist
        assert Monitor.objects.filter(id=monitor.id).exists()
        assert MonitorEnvironment.objects.filter(id=monitor_env.id).exists()

    def test_delete_monitor_with_incidents_and_detections(self) -> None:
        """
        Test that deleting a Monitor properly cascades to:
        - MonitorIncidents (deleted first via child relations)
        - MonitorCheckIns (bulk deleted after incidents)
        - MonitorEnvBrokenDetection (via MonitorIncident deletion)

        This verifies the ordered deletion: MonitorIncident → MonitorCheckIn → MonitorEnvironment
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

    def test_delete_monitor_with_shared_incident(self) -> None:
        """
        Test that deleting a Monitor handles edge case where one incident references
        multiple check-ins (starting_checkin != resolving_checkin).
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

    def test_delete_monitor_only_affects_its_own_data(self) -> None:
        """
        Test that deleting one Monitor doesn't affect another Monitor's data.
        This verifies that deletion queries are properly scoped by monitor_id.
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
