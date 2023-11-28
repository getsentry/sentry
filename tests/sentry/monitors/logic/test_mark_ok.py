from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.producer import PayloadType
from sentry.models.group import GroupStatus
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


@region_silo_test
class MarkOkTestCase(TestCase):
    def test_mark_ok_simple(self):
        now = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "max_runtime": None,
                "checkin_margin": None,
                "recovery_threshold": None,
            },
        )

        # Start with monitor in an ERROR state
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.ERROR,
            last_checkin=now - timedelta(minutes=1),
            next_checkin=now,
        )

        # OK checkin comes in
        success_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
            date_added=now,
        )
        mark_ok(success_checkin, ts=now)

        # Monitor has recovered to OK with updated upcoming timestamps
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)
        assert monitor_environment.next_checkin_latest == now + timedelta(minutes=2)
        assert monitor_environment.last_checkin == now

    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_ok_recovery_threshold(self, mock_produce_occurrence_to_kafka):
        now = timezone.now().replace(second=0, microsecond=0)

        recovery_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
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
            date_added=now,
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
            now = now + timedelta(minutes=1)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
                date_added=now,
            )
            mark_ok(checkin, checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        incident.refresh_from_db()
        monitor_environment.refresh_from_db()

        assert monitor_environment.status != MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)

        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None
        # Incident has not resolved
        assert incident.resolving_checkin is None
        assert incident.resolving_timestamp is None
        # no status change is sent to kafka occurrence consumer
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0

        # create another failed check-in to break the chain
        now = now + timedelta(minutes=1)
        last_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=now,
        )

        # Still not resolved
        incident.refresh_from_db()
        assert incident.resolving_checkin is None
        assert incident.resolving_timestamp is None

        # Create enough check-ins to resolve the incident
        for i in range(0, recovery_threshold):
            now = now + timedelta(minutes=1)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
                date_added=now,
            )
            if i == (recovery_threshold - 1):
                last_checkin = checkin
            mark_ok(checkin, checkin.date_added)

        # recovery has hit threshold, monitor should be in an ok state
        incident.refresh_from_db()
        monitor_environment.refresh_from_db()

        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.next_checkin == last_checkin.date_added + timedelta(minutes=1)

        # check that monitor environment has updated timestamp used for fingerprinting
        assert monitor_environment.last_state_change == monitor_environment.last_checkin
        # Incident resolved
        assert incident.resolving_checkin == last_checkin
        assert incident.resolving_timestamp == last_checkin.date_added

        # assert status change is sent to kafka occurrence consumer
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        payload_type, status_change = kwargs["payload_type"], kwargs["status_change"]
        status_change = status_change.to_dict()

        assert payload_type == PayloadType.STATUS_CHANGE
        assert dict(
            status_change,
            **{
                "fingerprint": [incident.grouphash],
                "project_id": monitor.project_id,
                "new_status": GroupStatus.RESOLVED,
                "new_substatus": None,
            },
        ) == dict(status_change)
