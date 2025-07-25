from datetime import timedelta
from unittest import mock

from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.test.utils import override_settings
from django.utils import timezone

from sentry.monitors.clock_dispatch import try_monitor_clock_tick
from sentry.monitors.consumers.clock_tasks_consumer import MonitorClockTasksStrategyFactory
from sentry.monitors.consumers.clock_tick_consumer import (
    MONITORS_CLOCK_TICK_CODEC,
    MonitorClockTickStrategyFactory,
)
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.system_incidents import DecisionResult, TickAnomalyDecision
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options

partition = Partition(Topic("test"), 0)


def create_consumer():
    factory = MonitorClockTickStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


@mock.patch("sentry.monitors.consumers.clock_tick_consumer.dispatch_check_missing")
@mock.patch("sentry.monitors.consumers.clock_tick_consumer.dispatch_check_timeout")
@mock.patch("sentry.monitors.consumers.clock_tick_consumer.process_clock_tick_for_system_incidents")
@override_options({"crons.system_incidents.use_decisions": True})
def test_simple(
    mock_process_clock_tick_for_system_incidents,
    mock_dispatch_check_timeout,
    mock_dispatch_check_missing,
):
    consumer = create_consumer()

    ts = timezone.now().replace(second=0, microsecond=0)

    # System incident reports a normal clock tick
    mock_process_clock_tick_for_system_incidents.return_value = DecisionResult(
        ts, TickAnomalyDecision.NORMAL, None
    )

    value = BrokerValue(
        KafkaPayload(b"fake-key", MONITORS_CLOCK_TICK_CODEC.encode({"ts": ts.timestamp()}), []),
        partition,
        1,
        ts,
    )
    consumer.submit(Message(value))

    assert mock_process_clock_tick_for_system_incidents.call_count == 1
    assert mock_process_clock_tick_for_system_incidents.mock_calls[0] == mock.call(ts)

    assert mock_dispatch_check_missing.call_count == 1
    assert mock_dispatch_check_missing.mock_calls[0] == mock.call(ts)

    assert mock_dispatch_check_timeout.call_count == 1
    assert mock_dispatch_check_timeout.mock_calls[0] == mock.call(ts)


@mock.patch("sentry.monitors.consumers.clock_tick_consumer.dispatch_mark_unknown")
@mock.patch("sentry.monitors.consumers.clock_tick_consumer.dispatch_check_missing")
@mock.patch("sentry.monitors.consumers.clock_tick_consumer.dispatch_check_timeout")
@mock.patch("sentry.monitors.consumers.clock_tick_consumer.process_clock_tick_for_system_incidents")
@override_options({"crons.system_incidents.use_decisions": True})
def test_incident_mark_unknown(
    mock_process_clock_tick_for_system_incidents,
    mock_dispatch_check_timeout,
    mock_dispatch_check_missing,
    mock_dispatch_mark_unknown,
):
    """
    Test that during an incident we mark in-progress check-ins as unknown and
    do NOT dispatch mark timeouts.
    """
    consumer = create_consumer()

    ts = timezone.now().replace(second=0, microsecond=0)

    mock_process_clock_tick_for_system_incidents.return_value = DecisionResult(
        ts, TickAnomalyDecision.INCIDENT, None
    )
    value = BrokerValue(
        KafkaPayload(b"fake-key", MONITORS_CLOCK_TICK_CODEC.encode({"ts": ts.timestamp()}), []),
        partition,
        1,
        ts,
    )
    consumer.submit(Message(value))

    assert mock_process_clock_tick_for_system_incidents.call_count == 1
    assert mock_process_clock_tick_for_system_incidents.mock_calls[0] == mock.call(ts)

    assert mock_dispatch_check_missing.call_count == 1
    assert mock_dispatch_check_missing.mock_calls[0] == mock.call(ts)

    assert mock_dispatch_check_timeout.call_count == 0

    assert mock_dispatch_mark_unknown.call_count == 1
    assert mock_dispatch_mark_unknown.mock_calls[0] == mock.call(ts)


class MonitorsClockTickEndToEndTest(TestCase):
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_end_to_end(self) -> None:
        ts = timezone.now().replace(second=0, microsecond=0)

        broker: LocalBroker[KafkaPayload] = LocalBroker(MemoryMessageStorage())

        clock_tick_topic = Topic("monitors-clock-tick")
        clock_tasks_topic = Topic("monitors-clock-tasks")

        broker.create_topic(clock_tick_topic, partitions=1)
        broker.create_topic(clock_tasks_topic, partitions=1)

        # Setup one monitor which should be marked as missed, and one check-in that
        # should be marked as timed-out
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 1,
                "max_runtime": 1,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=ts - timedelta(minutes=2),
            next_checkin=ts - timedelta(minutes=1),
            next_checkin_latest=ts,
        )
        checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=ts - timedelta(minutes=1),
            timeout_at=ts,
        )

        producer = broker.get_producer()
        tick_consumer = broker.get_consumer("monitors-clock-tick")
        tasks_consumer = broker.get_consumer("monitors-clock-tasks")

        # Dispatch a clock tick
        with mock.patch(
            "sentry.monitors.clock_dispatch._clock_tick_producer",
            producer,
        ):
            try_monitor_clock_tick(ts, 0)

        tick_processor = StreamProcessor(
            consumer=tick_consumer,
            topic=clock_tick_topic,
            processor_factory=MonitorClockTickStrategyFactory(),
            commit_policy=ONCE_PER_SECOND,
        )

        task_processor = StreamProcessor(
            consumer=tasks_consumer,
            topic=clock_tasks_topic,
            processor_factory=MonitorClockTasksStrategyFactory(),
            commit_policy=ONCE_PER_SECOND,
        )

        # Process the tick. This will produce two tasks, one for the missed
        # check-in and one for the timed-out check-in. This will produce two
        # tasks, one for the missed check-in and one for the timed-out check-in
        with mock.patch(
            "sentry.monitors.clock_tasks.producer._clock_task_producer",
            producer,
        ):
            tick_processor._run_once()

        # process the two tasks
        task_processor._run_once()
        task_processor._run_once()

        # Missed check-in was created
        missed_checkin = MonitorCheckIn.objects.filter(
            monitor_environment=monitor_environment, status=CheckInStatus.MISSED
        )
        assert missed_checkin.exists()
        # The missed check-in date_added is set to when it should have been
        # sent, not when we detect it
        assert missed_checkin[0].date_added == ts - timedelta(minutes=1)

        # Missed check-in was created
        checkin.refresh_from_db()
        assert checkin.status == CheckInStatus.TIMEOUT
