import uuid
from datetime import timedelta
from unittest import mock

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload
from django.test import override_settings
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry.monitors.grouptype import MonitorIncidentType
from sentry.monitors.logic.incident_occurrence import (
    MONITORS_INCIDENT_OCCURRENCES,
    dispatch_incident_occurrence,
    get_failure_reason,
    queue_incident_occurrence,
    send_incident_occurrence,
)
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.utils import ensure_cron_detector, get_detector_for_monitor
from sentry.testutils.cases import TestCase


class IncidentOccurrenceTestCase(TestCase):
    def build_occurrence_test_data(self):
        self.monitor = Monitor.objects.create(
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
        self.monitor_environment = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
        )

        self.successful_checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        self.last_checkin = timezone.now()
        self.trace_id = uuid.uuid4()

        self.timeout_checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
            trace_id=uuid.uuid4(),
            date_added=self.last_checkin - timedelta(minutes=1),
        )
        self.failed_checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            trace_id=self.trace_id,
            date_added=self.last_checkin,
        )
        self.incident = MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            starting_checkin=self.failed_checkin,
            starting_timestamp=self.last_checkin,
            grouphash="abcd",
        )

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_send_incident_occurrence(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        self.build_occurrence_test_data()
        send_incident_occurrence(
            self.failed_checkin,
            [self.timeout_checkin, self.failed_checkin],
            self.incident,
            self.last_checkin,
        )

        assert mock_produce_occurrence_to_kafka.call_count == 1
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs

        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [self.incident.grouphash],
                "issue_title": f"Cron failure: {self.monitor.name}",
                "subtitle": "Your monitor is failing: 1 timeout and 1 error check-ins detected.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {
                        "name": "Failure reason",
                        "value": "1 timeout and 1 error check-ins detected",
                        "important": True,
                    },
                    {
                        "name": "Environment",
                        "value": self.monitor_environment.get_environment().name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": self.successful_checkin.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorIncidentType.type_id,
                "level": "error",
                "culprit": "",
                "detection_time": self.failed_checkin.date_added.timestamp(),
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
                "contexts": {
                    "monitor": {
                        "status": "error",
                        "config": self.monitor.config,
                        "id": str(self.monitor.guid),
                        "name": self.monitor.name,
                        "slug": self.monitor.slug,
                    },
                    "trace": {
                        "trace_id": self.trace_id.hex,
                        "span_id": None,
                    },
                },
                "environment": self.monitor_environment.get_environment().name,
                "event_id": occurrence["event_id"],
                "fingerprint": [self.incident.grouphash],
                "platform": "other",
                "project_id": self.monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(self.monitor.guid),
                    "monitor.slug": str(self.monitor.slug),
                    "monitor.incident": str(self.incident.id),
                },
            },
        ) == dict(event)

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_send_incident_occurrence_detector(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        self.build_occurrence_test_data()
        ensure_cron_detector(self.monitor)
        send_incident_occurrence(
            self.failed_checkin,
            [self.timeout_checkin, self.failed_checkin],
            self.incident,
            self.last_checkin,
        )

        assert mock_produce_occurrence_to_kafka.call_count == 1
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs

        occurrence = kwargs["occurrence"]
        event = kwargs["event_data"]
        occurrence = occurrence.to_dict()

        detector = get_detector_for_monitor(self.monitor)
        assert detector
        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [self.incident.grouphash],
                "issue_title": f"Cron failure: {self.monitor.name}",
                "subtitle": "Your monitor is failing: 1 timeout and 1 error check-ins detected.",
                "resource_id": None,
                "evidence_data": {"detector_id": detector.id},
                "evidence_display": [
                    {
                        "name": "Failure reason",
                        "value": "1 timeout and 1 error check-ins detected",
                        "important": True,
                    },
                    {
                        "name": "Environment",
                        "value": self.monitor_environment.get_environment().name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": self.successful_checkin.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorIncidentType.type_id,
                "level": "error",
                "culprit": "",
                "detection_time": self.failed_checkin.date_added.timestamp(),
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
                "contexts": {
                    "monitor": {
                        "status": "error",
                        "config": self.monitor.config,
                        "id": str(self.monitor.guid),
                        "name": self.monitor.name,
                        "slug": self.monitor.slug,
                    },
                    "trace": {
                        "trace_id": self.trace_id.hex,
                        "span_id": None,
                    },
                },
                "environment": self.monitor_environment.get_environment().name,
                "event_id": occurrence["event_id"],
                "fingerprint": [self.incident.grouphash],
                "platform": "other",
                "project_id": self.monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(self.monitor.guid),
                    "monitor.slug": str(self.monitor.slug),
                    "monitor.incident": str(self.incident.id),
                },
            },
        ) == dict(event)

    def test_failure_reason(self) -> None:
        monitor = self.create_monitor()
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
        )
        timeout_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.TIMEOUT,
        )
        error_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )
        miss_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.MISSED,
        )

        assert get_failure_reason([error_checkin]) == "An error check-in was detected"
        assert get_failure_reason([timeout_checkin]) == "A timeout check-in was detected"
        assert get_failure_reason([miss_checkin]) == "A missed check-in was detected"

        assert (
            get_failure_reason([error_checkin, miss_checkin, timeout_checkin])
            == "1 error, 1 missed and 1 timeout check-ins detected"
        )
        assert (
            get_failure_reason([miss_checkin, timeout_checkin])
            == "1 missed and 1 timeout check-ins detected"
        )

    @override_settings(
        KAFKA_TOPIC_OVERRIDES={"monitors-incident-occurrences": "monitors-test-topic"}
    )
    @mock.patch("sentry.monitors.logic.incident_occurrence._incident_occurrence_producer")
    def test_queue_incident_occurrence(self, mock_producer: mock.MagicMock) -> None:
        tick = timezone.now().replace(second=0, microsecond=0)

        monitor = self.create_monitor()
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
        )

        last_checkin = timezone.now()
        trace_id = uuid.uuid4()

        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            trace_id=trace_id,
            date_added=last_checkin,
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=failed_checkin,
            starting_timestamp=last_checkin,
        )

        queue_incident_occurrence(
            failed_checkin,
            [failed_checkin],
            incident,
            last_checkin,
            tick,
        )

        incident_occurrence: IncidentOccurrence = {
            "incident_id": incident.id,
            "failed_checkin_id": failed_checkin.id,
            "previous_checkin_ids": [failed_checkin.id],
            "received_ts": int(last_checkin.timestamp()),
            "clock_tick_ts": int(tick.timestamp()),
        }
        test_payload = KafkaPayload(
            str(monitor_environment.id).encode(),
            MONITORS_INCIDENT_OCCURRENCES.encode(incident_occurrence),
            [],
        )

        assert mock_producer.produce.call_count == 1
        assert mock_producer.produce.mock_calls[0] == mock.call(
            Topic("monitors-test-topic"), test_payload
        )

    @mock.patch("sentry.monitors.logic.incident_occurrence.produce_occurrence_to_kafka")
    def test_send_incident_occurrence_invalid_owner(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        self.build_occurrence_test_data()
        team = self.create_team(organization=self.organization)
        self.monitor.update(owner_team_id=team.id)
        self.monitor.refresh_from_db()
        other_org = self.create_organization()
        team.update(organization_id=other_org.id)

        send_incident_occurrence(
            self.failed_checkin,
            [self.timeout_checkin, self.failed_checkin],
            self.incident,
            self.last_checkin,
        )

        self.monitor.refresh_from_db()
        assert self.monitor.owner_team_id is None
        assert self.monitor.owner_user_id is None
        assert mock_produce_occurrence_to_kafka.call_count == 1
        kwargs = mock_produce_occurrence_to_kafka.call_args.kwargs
        occurrence = kwargs["occurrence"]
        assert occurrence.assignee is None

    @mock.patch("sentry.monitors.logic.incident_occurrence.send_incident_occurrence")
    @mock.patch("sentry.monitors.logic.incident_occurrence.queue_incident_occurrence")
    def test_dispatch_incident_occurrence(
        self,
        mock_queue_incident_occurrence,
        mock_send_incident_occurrence,
    ):
        monitor = self.create_monitor()
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
        )
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now(),
        )
        incident = MonitorIncident.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            starting_checkin=failed_checkin,
            starting_timestamp=failed_checkin.date_added,
        )

        # Sending without tick triggers send_incident_occurrence
        dispatch_incident_occurrence(
            failed_checkin,
            [failed_checkin],
            incident,
            received=failed_checkin.date_added,
            clock_tick=None,
        )
        assert mock_send_incident_occurrence.call_count == 1
        mock_send_incident_occurrence.reset_mock()

        # Sending with tick triggers send_incident_occurrence unless we enable
        # the crons.dispatch_incident_occurrences_to_consumer option
        dispatch_incident_occurrence(
            failed_checkin,
            [failed_checkin],
            incident,
            received=failed_checkin.date_added,
            clock_tick=timezone.now(),
        )
        assert mock_send_incident_occurrence.call_count == 1
        mock_send_incident_occurrence.reset_mock()

        # Sending with tick and option set dispatches via
        # queue_incident_occurrence
        with self.options({"crons.dispatch_incident_occurrences_to_consumer": True}):
            dispatch_incident_occurrence(
                failed_checkin,
                [failed_checkin],
                incident,
                received=failed_checkin.date_added,
                clock_tick=timezone.now(),
            )
            assert mock_queue_incident_occurrence.call_count == 1
            assert mock_send_incident_occurrence.call_count == 0
