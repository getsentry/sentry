import uuid
from datetime import datetime
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone
from sentry_kafka_schemas.schema_types.monitors_incident_occurrences_v1 import IncidentOccurrence

from sentry.monitors.consumers.incident_occurrences_consumer import (
    MONITORS_INCIDENT_OCCURRENCES,
    MonitorIncidentOccurenceStrategyFactory,
)
from sentry.monitors.models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorIncident,
    MonitorStatus,
)
from sentry.testutils.cases import TestCase

partition = Partition(Topic("test"), 0)


def create_consumer() -> ProcessingStrategy[KafkaPayload]:
    factory = MonitorIncidentOccurenceStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


def sned_incident_occurrence(
    consumer: ProcessingStrategy[KafkaPayload],
    ts: datetime,
    incident_occurrence: IncidentOccurrence,
):
    value = BrokerValue(
        KafkaPayload(b"fake-key", MONITORS_INCIDENT_OCCURRENCES.encode(incident_occurrence), []),
        partition,
        1,
        ts,
    )
    consumer.submit(Message(value))


class MonitorsIncidentOccurrenceConsumerTestCase(TestCase):
    @mock.patch(
        "sentry.monitors.consumers.incident_occurrences_consumer.create_incident_occurrence"
    )
    def test_simple(self, mock_create_incident_occurrence):
        ts = timezone.now().replace(second=0, microsecond=0)

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

        consumer = create_consumer()
        sned_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(last_checkin.timestamp()),
                "incident_id": incident.id,
                "failed_checkin_id": failed_checkin.id,
                "previous_checkin_ids": [failed_checkin.id],
            },
        )

        assert mock_create_incident_occurrence.call_count == 1
        assert mock_create_incident_occurrence.mock_calls[0] == mock.call(
            failed_checkin,
            [failed_checkin],
            incident,
            last_checkin.replace(microsecond=0),
        )

    @mock.patch("sentry.monitors.consumers.incident_occurrences_consumer.logger")
    def test_missing_data(self, mock_logger):
        ts = timezone.now().replace(second=0, microsecond=0)

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

        consumer = create_consumer()

        # Send with bad incident id
        sned_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(last_checkin.timestamp()),
                "incident_id": 1234,
                "failed_checkin_id": failed_checkin.id,
                "previous_checkin_ids": [failed_checkin.id],
            },
        )
        mock_logger.exception.assert_called_with("missing_incident")

        # Send with bad failed_checkin_id
        sned_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(last_checkin.timestamp()),
                "incident_id": incident.id,
                "failed_checkin_id": 1234,
                "previous_checkin_ids": [failed_checkin.id],
            },
        )
        mock_logger.error.assert_called_with("missing_check_ins")

        # Send with bad previous_checkin_ids
        sned_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(last_checkin.timestamp()),
                "incident_id": incident.id,
                "failed_checkin_id": failed_checkin.id,
                "previous_checkin_ids": [123],
            },
        )
        mock_logger.error.assert_called_with("missing_check_ins")
