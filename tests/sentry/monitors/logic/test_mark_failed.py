import uuid
from datetime import timedelta
from itertools import cycle
from unittest import mock

from django.utils import timezone

from sentry.issues.ingest import process_occurrence_data
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.monitors.logic.incidents import LAST_SUCCESSFUL_LOOKBACK
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    ScheduleType,
    is_monitor_muted,
)
from sentry.testutils.cases import TestCase


class MarkFailedTestCase(TestCase):
    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_default_params(
        self, mock_dispatch_incident_occurrence: mock.MagicMock
    ) -> None:
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        last_checkin = timezone.now()
        trace_id = uuid.uuid4()

        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
            trace_id=trace_id,
            date_added=last_checkin,
        )
        assert mark_failed(checkin, failed_at=checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.ERROR

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 1

        assert mock_dispatch_incident_occurrence.call_count == 1
        assert mock_dispatch_incident_occurrence.call_args == mock.call(
            checkin,
            [checkin],
            monitor_incidents[0],
            checkin.date_added,
            None,
        )

    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_muted(self, mock_dispatch_incident_occurrence: mock.MagicMock) -> None:
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            is_muted=True,
        )
        assert monitor_environment.active_incident is None
        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.UNKNOWN,
        )
        assert mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert is_monitor_muted(monitor)
        assert monitor_environment.status == MonitorStatus.ERROR

        assert mock_dispatch_incident_occurrence.call_count == 0
        assert monitor_environment.active_incident is not None

    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_issue_threshold(
        self, mock_dispatch_incident_occurrence: mock.MagicMock
    ) -> None:
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
        )

        failure_statuses = cycle([CheckInStatus.ERROR, CheckInStatus.TIMEOUT, CheckInStatus.MISSED])

        for _ in range(0, failure_issue_threshold - 1):
            status = next(failure_statuses)
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=status,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK

        # create another OK check-in to break the chain
        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
        )

        for _ in range(0, failure_issue_threshold):
            status = next(failure_statuses)
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=status,
            )
            if _ == 0:
                first_checkin = checkin
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert mock_dispatch_incident_occurrence.call_count == failure_issue_threshold

        # send another check-in to make sure the incident does not change
        status = next(failure_statuses)
        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=status,
        )
        mark_failed(checkin, failed_at=checkin.date_added)
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that incident has not changed
        monitor_incident = MonitorIncident.objects.get(id=monitor_incident.id)
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert mock_dispatch_incident_occurrence.call_count == failure_issue_threshold + 1

        # Resolve the incident with an OK check-in
        ok_checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=MonitorStatus.OK,
        )
        monitor_incident.resolving_checkin = ok_checkin
        monitor_incident.resolving_timestamp = ok_checkin.date_added
        monitor_incident.save()
        monitor_environment.status = MonitorStatus.OK
        monitor_environment.save()

        # Cause a new incident and ensure we create a new incident
        for _ in range(0, failure_issue_threshold):
            status = next(failure_statuses)
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=status,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        monitor_incidents = MonitorIncident.objects.filter(monitor_environment=monitor_environment)
        assert len(monitor_incidents) == 2

    # Test to make sure that timeout mark_failed (which occur in the past)
    # correctly create issues once passing the failure_issue_threshold
    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_issue_threshold_timeout(
        self, mock_dispatch_incident_occurrence: mock.MagicMock
    ) -> None:
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
        )

        # create in-progress check-ins
        checkins = []
        for i in range(0, failure_issue_threshold + 1):
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.IN_PROGRESS,
            )
            checkins.append(checkin)
            if i == 0:
                first_checkin = checkin

        # mark check-ins as failed
        for _ in range(0, failure_issue_threshold - 1):
            checkin = checkins.pop(0)
            checkin.update(status=CheckInStatus.TIMEOUT)
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK

        checkin = checkins.pop(0)
        checkin.update(status=CheckInStatus.TIMEOUT)
        mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == first_checkin
        assert monitor_incident.starting_timestamp == first_checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash

        # assert correct number of occurrences was sent
        assert mock_dispatch_incident_occurrence.call_count == failure_issue_threshold

    # we are duplicating this test as the code paths are different, for now
    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_issue_threshold_disabled(
        self, mock_dispatch_incident_occurrence: mock.MagicMock
    ) -> None:
        failure_issue_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            is_muted=True,
        )
        assert monitor_environment.active_incident is None
        for _ in range(0, failure_issue_threshold):
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.UNKNOWN,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert is_monitor_muted(monitor)
        assert monitor_environment.status == MonitorStatus.ERROR

        assert mock_dispatch_incident_occurrence.call_count == 0
        assert monitor_environment.active_incident is not None

    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    def test_mark_failed_new_monitor_issue_threshold(
        self, mock_dispatch_incident_occurrence: mock.MagicMock
    ) -> None:
        failure_issue_threshold = 3
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        for _ in range(failure_issue_threshold - 1):
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.ERROR,
            )
            assert not mark_failed(checkin, failed_at=checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.active_incident is None
        mock_dispatch_incident_occurrence.assert_not_called()

        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
        )
        assert mark_failed(checkin, failed_at=checkin.date_added)

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.active_incident is not None
        assert mock_dispatch_incident_occurrence.call_count == failure_issue_threshold

    def test_mark_failed_issue_assignment(self) -> None:
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "max_runtime": None,
                "checkin_margin": None,
            },
            owner_user_id=self.user.id,
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
        )

        checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.IN_PROGRESS,
        )
        mark_failed(checkin, failed_at=checkin.date_added)

        # failure has hit threshold, monitor should be in a failed state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR

        # check that an incident has been created correctly
        monitor_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert monitor_incident.starting_checkin == checkin
        assert monitor_incident.starting_timestamp == checkin.date_added
        assert monitor_environment.active_incident is not None
        assert monitor_incident.grouphash == monitor_environment.active_incident.grouphash
        occurrence_data = {"fingerprint": [monitor_environment.active_incident.grouphash]}
        process_occurrence_data(occurrence_data)
        issue_platform_hash = occurrence_data["fingerprint"][0]

        grouphash = GroupHash.objects.get(hash=issue_platform_hash)
        group_assignee = GroupAssignee.objects.get(group_id=grouphash.group_id)
        assert group_assignee.user_id == monitor.owner_user_id

    @mock.patch("sentry.monitors.logic.incidents.dispatch_incident_occurrence")
    @mock.patch("sentry.monitors.logic.incident_occurrence.resolve_incident_group")
    def test_mark_failed_fingerprint_after_resolution(
        self,
        mock_resolve_incident_group: mock.MagicMock,
        mock_dispatch_incident_occurrence: mock.MagicMock,
    ) -> None:
        """Test that resolving and recreating an incident maintains the same fingerprint"""
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "hour"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": 3,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )
        expected_fingerprint = f"crons:{monitor_environment.id}"

        for i in range(3):
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.ERROR,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        first_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert first_incident.grouphash == expected_fingerprint

        ok_checkin = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
        )

        from sentry.monitors.logic.mark_ok import mark_ok

        mark_ok(ok_checkin, ok_checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK

        first_incident.refresh_from_db()
        assert first_incident.resolving_checkin == ok_checkin

        for i in range(3):
            checkin = self.create_monitor_checkin(
                monitor_environment=monitor_environment,
                status=CheckInStatus.ERROR,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        incidents = MonitorIncident.objects.filter(
            monitor_environment=monitor_environment
        ).order_by("date_added")
        assert incidents.count() == 2

        second_incident = incidents.last()
        assert second_incident
        assert second_incident.id != first_incident.id
        assert second_incident.grouphash == expected_fingerprint
        assert second_incident.grouphash == first_incident.grouphash

    def _create_monitor_environment(self, failure_issue_threshold: int) -> MonitorEnvironment:
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "failure_issue_threshold": failure_issue_threshold,
                "max_runtime": None,
                "checkin_margin": None,
            },
        )
        return MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
        )

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_mark_failed_sets_last_successful_timestamp(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        monitor_environment = self._create_monitor_environment(failure_issue_threshold=2)
        now = timezone.now().replace(microsecond=0)

        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
            date_added=now - timedelta(minutes=10),
        )
        last_ok = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
            date_added=now - timedelta(minutes=5),
        )
        first_failure = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
            date_added=now - timedelta(minutes=2),
        )
        mark_failed(first_failure, failed_at=first_failure.date_added)
        failure = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
            date_added=now,
        )
        assert mark_failed(failure, failed_at=failure.date_added)

        incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert incident.starting_checkin_id == first_failure.id
        assert incident.last_successful_timestamp == last_ok.date_added

        evidence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"].evidence_display
        assert evidence[2].name == "Last successful check-in"
        assert evidence[2].value == last_ok.date_added.isoformat()

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_mark_failed_no_successful_checkin(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        monitor_environment = self._create_monitor_environment(failure_issue_threshold=1)
        failure = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
        )
        assert mark_failed(failure, failed_at=failure.date_added)

        incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert incident.last_successful_timestamp is None

        evidence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"].evidence_display
        assert evidence[2].value == "Never"

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_mark_failed_ignores_successful_checkin_past_lookback(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        monitor_environment = self._create_monitor_environment(failure_issue_threshold=1)
        now = timezone.now().replace(microsecond=0)

        self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.OK,
            date_added=now - LAST_SUCCESSFUL_LOOKBACK - timedelta(minutes=1),
        )
        failure = self.create_monitor_checkin(
            monitor_environment=monitor_environment,
            status=CheckInStatus.ERROR,
            date_added=now,
        )
        assert mark_failed(failure, failed_at=failure.date_added)

        incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert incident.last_successful_timestamp is None
