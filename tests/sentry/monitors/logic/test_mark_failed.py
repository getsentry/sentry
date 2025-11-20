import uuid
from itertools import cycle
from unittest import mock

from django.utils import timezone

from sentry.issues.ingest import process_occurrence_data
from sentry.models.groupassignee import GroupAssignee
from sentry.models.grouphash import GroupHash
from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
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

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
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
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
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

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        failure_statuses = cycle([CheckInStatus.ERROR, CheckInStatus.TIMEOUT, CheckInStatus.MISSED])

        for _ in range(0, failure_issue_threshold - 1):
            status = next(failure_statuses)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=status,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK

        # create another OK check-in to break the chain
        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        for _ in range(0, failure_issue_threshold):
            status = next(failure_statuses)
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
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
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
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
        ok_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
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
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
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

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        # create in-progress check-ins
        checkins = []
        for i in range(0, failure_issue_threshold + 1):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
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
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.UNKNOWN,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert is_monitor_muted(monitor)
        assert monitor_environment.status == MonitorStatus.ERROR

        assert mock_dispatch_incident_occurrence.call_count == 0
        assert monitor_environment.active_incident is not None

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

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
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
        self, mock_resolve_incident_group, mock_dispatch_incident_occurrence
    ):
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
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.ERROR,
            )
            mark_failed(checkin, failed_at=checkin.date_added)

        first_incident = MonitorIncident.objects.get(monitor_environment=monitor_environment)
        assert first_incident.grouphash == expected_fingerprint

        ok_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        from sentry.monitors.logic.mark_ok import mark_ok

        mark_ok(ok_checkin, ok_checkin.date_added)

        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.OK

        first_incident.refresh_from_db()
        assert first_incident.resolving_checkin == ok_checkin

        for i in range(3):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
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
