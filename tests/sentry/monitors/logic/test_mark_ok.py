from unittest.mock import patch

from sentry.monitors.logic.mark_failed import mark_failed
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
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MarkOkTestCase(TestCase):
    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_ok_recovery_threshold(self, mock_produce_occurrence_to_kafka):
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
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.ERROR,
            last_state_change=None,
        )

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )

        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=checkin,
            starting_timestamp=checkin.date_added,
            grouphash=monitor_environment.incident_grouphash,
        )

        for i in range(0, recovery_threshold - 1):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
            )
            mark_ok(checkin, checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status != MonitorStatus.OK
        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None

        # create another failed check-in to break the chain
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )
        mark_failed(failed_checkin, ts=failed_checkin.date_added)
        # assert occurrence was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

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
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        # check that monitor environment has updated timestamp used for fingerprinting
        assert monitor_environment.last_state_change == monitor_environment.last_checkin

        # check that resolving check-in is set on the incident
        incident = MonitorIncident.objects.get(id=incident.id)
        assert incident.resolving_checkin == last_checkin
        assert incident.resolving_timestamp == last_checkin.date_added
