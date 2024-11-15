from datetime import datetime
from unittest import mock

import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import MessageRejected, ProcessingStrategy
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
from sentry.monitors.system_incidents import TickAnomalyDecision
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options

partition = Partition(Topic("test"), 0)


def create_consumer() -> ProcessingStrategy[KafkaPayload]:
    factory = MonitorIncidentOccurenceStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


def send_incident_occurrence(
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
    def setUp(self):
        super().setUp()
        self.monitor = self.create_monitor()
        self.monitor_environment = MonitorEnvironment.objects.create(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.ERROR,
        )
        self.failed_checkin = MonitorCheckIn.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
            date_added=timezone.now(),
        )
        self.incident = MonitorIncident.objects.create(
            monitor=self.monitor,
            monitor_environment=self.monitor_environment,
            starting_checkin=self.failed_checkin,
            starting_timestamp=self.failed_checkin.date_added,
        )

    @mock.patch("sentry.monitors.consumers.incident_occurrences_consumer.send_incident_occurrence")
    def test_simple(self, mock_send_incident_occurrence):
        ts = timezone.now().replace(second=0, microsecond=0)

        consumer = create_consumer()
        send_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(self.failed_checkin.date_added.timestamp()),
                "incident_id": self.incident.id,
                "failed_checkin_id": self.failed_checkin.id,
                "previous_checkin_ids": [self.failed_checkin.id],
            },
        )

        assert mock_send_incident_occurrence.call_count == 1
        assert mock_send_incident_occurrence.mock_calls[0] == mock.call(
            self.failed_checkin,
            [self.failed_checkin],
            self.incident,
            self.failed_checkin.date_added.replace(microsecond=0),
        )

    @mock.patch("sentry.monitors.consumers.incident_occurrences_consumer.logger")
    def test_missing_data(self, mock_logger):
        ts = timezone.now().replace(second=0, microsecond=0)

        consumer = create_consumer()

        # Send with bad incident id
        send_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(self.failed_checkin.date_added.timestamp()),
                "incident_id": 1234,
                "failed_checkin_id": self.failed_checkin.id,
                "previous_checkin_ids": [self.failed_checkin.id],
            },
        )
        mock_logger.exception.assert_called_with("missing_incident")

        # Send with bad failed_checkin_id
        send_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(self.failed_checkin.date_added.timestamp()),
                "incident_id": self.incident.id,
                "failed_checkin_id": 1234,
                "previous_checkin_ids": [self.failed_checkin.id],
            },
        )
        mock_logger.error.assert_called_with("missing_check_ins")

        # Send with bad previous_checkin_ids
        send_incident_occurrence(
            consumer,
            ts,
            {
                "clock_tick_ts": int(ts.timestamp()),
                "received_ts": int(self.failed_checkin.date_added.timestamp()),
                "incident_id": self.incident.id,
                "failed_checkin_id": self.failed_checkin.id,
                "previous_checkin_ids": [123],
            },
        )
        mock_logger.error.assert_called_with("missing_check_ins")

    @mock.patch("sentry.monitors.consumers.incident_occurrences_consumer.send_incident_occurrence")
    @mock.patch("sentry.monitors.consumers.incident_occurrences_consumer.memoized_tick_decision")
    @override_options({"crons.system_incidents.use_decisions": True})
    def test_delayed_decision_dispatch(
        self,
        mock_memoized_tick_decision,
        mock_send_incident_occurrence,
    ):
        """
        Tests that the consumer does NOT send an incident occurrence when the
        clock tick decision is marked as ABNORMAL or RECOVERING. In these cases
        we expect the consumer to just keep checking the decision until it
        resolve to INCIDENT or NORMAL
        """
        mock_memoized_tick_decision.return_value = TickAnomalyDecision.ABNORMAL

        ts = timezone.now().replace(second=0, microsecond=0)

        consumer = create_consumer()

        message: IncidentOccurrence = {
            "clock_tick_ts": int(ts.timestamp()),
            "received_ts": int(self.failed_checkin.date_added.timestamp()),
            "incident_id": self.incident.id,
            "failed_checkin_id": self.failed_checkin.id,
            "previous_checkin_ids": [self.failed_checkin.id],
        }

        # Raises a message rejected and does not send the occurrence
        with pytest.raises(MessageRejected):
            send_incident_occurrence(consumer, ts, message)
            assert mock_send_incident_occurrence.call_count == 0

        # Tick decision resolves to OK
        mock_memoized_tick_decision.return_value = TickAnomalyDecision.NORMAL
        send_incident_occurrence(consumer, ts, message)
        assert mock_send_incident_occurrence.call_count == 1
