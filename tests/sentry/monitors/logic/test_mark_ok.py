from datetime import timedelta
from unittest import mock
from unittest.mock import MagicMock, patch

from django.utils import timezone

from sentry.analytics.events.cron_monitor_broken_status_recovery import (
    CronMonitorBrokenStatusRecovery,
)
from sentry.issues.producer import PayloadType
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import GroupOpenPeriod
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.logic.mark_ok import mark_ok
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.utils import ensure_cron_detector
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.analytics import assert_last_analytics_event
from sentry.testutils.helpers.datetime import freeze_time


class MarkOkTestCase(TestCase):
    def test_mark_ok_simple(self) -> None:
        now = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
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
            monitor_environment=monitor_environment,
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

    def test_muted_ok(self) -> None:
        now = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
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
            is_muted=True,
        )

        # OK checkin comes in
        success_checkin = MonitorCheckIn.objects.create(
            monitor_environment=monitor_environment,
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
    def test_mark_ok_recovery_threshold(self, mock_produce_occurrence_to_kafka: MagicMock) -> None:
        now = timezone.now().replace(second=0, microsecond=0)

        recovery_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
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
            monitor_environment=monitor_environment,
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
                monitor_environment=monitor_environment,
                status=CheckInStatus.OK,
                date_added=now,
            )
            mark_ok(checkin, checkin.date_added)

        # create an in-progress check-in to make sure that we don't resolve anything
        now = now + timedelta(minutes=1)
        checkin = MonitorCheckIn.objects.create(
            monitor_environment=monitor_environment,
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
            monitor_environment=monitor_environment,
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
                monitor_environment=monitor_environment,
                status=CheckInStatus.OK,
                date_added=now,
            )
            if i == (recovery_threshold - 1):
                last_checkin = checkin
            mark_ok(checkin, checkin.date_added)

        # recovery has hit threshold, monitor should be in an ok state
        incident = MonitorIncident.objects.get(id=incident.id)
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
                "update_date": last_checkin.date_added,
            },
        ) == dict(status_change)

    @mock.patch("sentry.analytics.record")
    def test_mark_ok_broken_recovery(self, mock_record: MagicMock) -> None:
        now = timezone.now().replace(second=0, microsecond=0)

        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
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
            monitor_environment=monitor_environment,
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
            monitor_environment=monitor_environment,
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
        assert_last_analytics_event(
            mock_record,
            CronMonitorBrokenStatusRecovery(
                organization_id=self.organization.id,
                project_id=self.project.id,
                monitor_id=monitor.id,
                monitor_env_id=monitor_environment.id,
            ),
        )

    def test_mark_ok_closes_open_period_opened_by_a_delayed_failure_occurrence(self) -> None:
        """
        SENTRY-4EDG. A failure occurrence can reach the issue platform after relay has already
        received the recovering OK check-in. The regression open period must start at the
        failure's relay time, not at the time the occurrence was processed, so the resolve
        stamped with the OK check-in's relay time can close it.
        """
        now = timezone.now().replace(second=0, microsecond=0)

        monitor = self.create_monitor()

        monitor_environment = self.create_monitor_environment(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        ensure_cron_detector(monitor)

        first_failed_at = now - timedelta(minutes=10)

        first_recovered_at = now - timedelta(minutes=9)

        second_failed_at = now - timedelta(minutes=5)

        second_recovered_at = second_failed_at + timedelta(seconds=5)

        second_failure_processed_at = second_failed_at + timedelta(seconds=10)

        with freeze_time(first_failed_at):
            failed_checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.ERROR,
                date_added=first_failed_at,
            )

            mark_failed(failed_checkin, failed_at=first_failed_at, received=first_failed_at)

        with freeze_time(first_recovered_at):
            ok_checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.OK,
                date_added=first_recovered_at,
            )

            mark_ok(ok_checkin, first_recovered_at)

        with freeze_time(second_failure_processed_at):
            failed_checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.ERROR,
                date_added=second_failed_at,
            )

            mark_failed(failed_checkin, failed_at=second_failed_at, received=second_failed_at)

        with freeze_time(second_failure_processed_at + timedelta(seconds=1)):
            ok_checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.OK,
                date_added=second_recovered_at,
            )

            mark_ok(ok_checkin, second_recovered_at)

        group = Group.objects.get(project=self.project, type=MonitorIncidentType.type_id)

        open_periods = GroupOpenPeriod.objects.filter(group=group).order_by("date_started")

        assert group.status == GroupStatus.RESOLVED
        assert [(period.date_started, period.date_ended) for period in open_periods] == [
            (first_failed_at, first_recovered_at),
            (second_failed_at, second_recovered_at),
        ]
