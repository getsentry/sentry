from sentry.monitors.logic.mark_ok import mark_ok
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MarkOkTestCase(TestCase):
    def test_mark_ok_recovery_threshold(self):
        recovery_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "recovery_threshold": recovery_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )

        # Start with monitor in an ERROR state with an active incident
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.ERROR,
            last_state_change=None,
        )
        first_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=first_checkin,
            starting_timestamp=first_checkin.date_added,
            grouphash=monitor_environment.incident_grouphash,
        )

        # Create OK check-ins
        for i in range(0, recovery_threshold - 1):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
            )
            mark_ok(checkin, checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        incident.refresh_from_db()
        monitor_environment.refresh_from_db()

        assert monitor_environment.status != MonitorStatus.OK
        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None
        # Incidnet has not resolved
        assert incident.resolving_checkin is None
        assert incident.resolving_timestamp is None

        # create another failed check-in to break the chain
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )

        # Still not resolved
        incident.refresh_from_db()
        assert incident.resolving_checkin is None
        assert incident.resolving_timestamp is None

        # Create enough check-ins to resolve the incident
        last_checkin = None
        for i in range(0, recovery_threshold):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
            )
            if i == (recovery_threshold - 1):
                last_checkin = checkin
            mark_ok(checkin, checkin.date_added)

        # recovery has hit threshold, monitor should be in an ok state
        incident.refresh_from_db()
        monitor_environment.refresh_from_db()

        assert monitor_environment.status == MonitorStatus.OK
        # check that monitor environment has updated timestamp used for fingerprinting
        assert monitor_environment.last_state_change == monitor_environment.last_checkin
        # Incident reoslved
        assert incident.resolving_checkin == last_checkin
        assert incident.resolving_timestamp == last_checkin.date_added
