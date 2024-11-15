from datetime import timedelta
from unittest import mock
from unittest.mock import patch

from django.utils import timezone

from sentry.issues.producer import PayloadType
from sentry.models.group import GroupStatus
from sentry.monitors.logic.mark_ok import mark_ok
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils.cases import TestCase


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
            environment_id=self.environment.id,
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
        mark_ok(success_checkin, now)

        # Monitor has recovered to OK with updated upcoming timestamps
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)
        assert monitor_environment.next_checkin_latest == now + timedelta(minutes=2)
        assert monitor_environment.last_checkin == now

    def test_muted_ok(self):
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
            is_muted=True,
        )

        # Start with monitor in an ERROR state
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
            last_checkin=now - timedelta(minutes=1),
            next_checkin=now,
            is_muted=True,
        )

        # OK checkin comes in
        success_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
            date_added=now,
        )
        mark_ok(success_checkin, now)

        # Monitor has recovered to OK with updated upcoming timestamps
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)
        assert monitor_environment.next_checkin_latest == now + timedelta(minutes=2)
        assert monitor_environment.last_checkin == now

    @patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
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
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
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

        # create an in-progress check-in to make sure that we don't resolve anything
        now = now + timedelta(minutes=1)
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=now,
        )
        mark_ok(checkin, checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        incident.refresh_from_db()
        monitor_environment.refresh_from_db()

        assert monitor_environment.status != MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)

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

    @mock.patch("sentry.analytics.record")
    def test_mark_ok_broken_recovery(self, mock_record):
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

        # Start with monitor in an ERROR state and broken detection
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
            last_checkin=now - timedelta(minutes=1),
            next_checkin=now,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now() - timedelta(days=14),
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=checkin,
            starting_timestamp=checkin.date_added,
        )
        MonitorEnvBrokenDetection.objects.create(
            monitor_incident=incident,
        )

        # OK checkin comes in
        success_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
            date_added=now,
        )
        mark_ok(success_checkin, now)

        # Monitor has recovered to OK with updated upcoming timestamps
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.next_checkin == now + timedelta(minutes=1)
        assert monitor_environment.next_checkin_latest == now + timedelta(minutes=2)
        assert monitor_environment.last_checkin == now

        # We recorded an analytics event
        mock_record.assert_called_with(
            "cron_monitor_broken_status.recovery",
            organization_id=self.organization.id,
            project_id=self.project.id,
            monitor_id=monitor.id,
            monitor_env_id=monitor_environment.id,
        )
