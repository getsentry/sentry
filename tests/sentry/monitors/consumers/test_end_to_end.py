from typing import int
import contextlib
import uuid
from collections.abc import Generator
from datetime import datetime, timedelta
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.backends.local.backend import LocalBroker
from arroyo.backends.local.storages.memory import MemoryMessageStorage
from arroyo.commit import ONCE_PER_SECOND
from arroyo.processing.processor import StreamProcessor
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.test.utils import override_settings
from django.utils import timezone
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

import sentry.testutils.thread_leaks.pytest as thread_leaks
from sentry.monitors.clock_dispatch import try_monitor_clock_tick
from sentry.monitors.consumers.clock_tasks_consumer import MonitorClockTasksStrategyFactory
from sentry.monitors.consumers.clock_tick_consumer import MonitorClockTickStrategyFactory
from sentry.monitors.consumers.monitor_consumer import StoreMonitorCheckInStrategyFactory
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    ScheduleType,
)
from sentry.monitors.processing_errors.errors import ProcessingErrorsException
from sentry.monitors.types import CheckinItem
from sentry.testutils.cases import TestCase
from sentry.utils import json


class ExpectNoProcessingError:
    pass


partition = Partition(Topic("test"), 0)


def create_consumer():
    factory = StoreMonitorCheckInStrategyFactory()
    commit = mock.Mock()
    return factory.create_with_partitions(commit, {partition: 0})


@thread_leaks.thread_leak_allowlist(reason="monitors", issue=97032)
class MonitorsClockTickEndToEndTest(TestCase):
    def send_checkin(
        self,
        status: str,
        guid: str | None = None,
        ts: datetime | None = None,
        item_ts: datetime | None = None,
    ) -> str:
        if ts is None:
            ts = self.time.replace(tzinfo=None)
        if item_ts is None:
            item_ts = ts

        guid = uuid.uuid4().hex if not guid else guid
        trace_id = uuid.uuid4().hex

        payload = {
            "monitor_slug": self.monitor.slug,
            "status": status,
            "check_in_id": guid,
            "environment": "production",
            "contexts": {"trace": {"trace_id": trace_id}},
        }

        wrapper: CheckIn = {
            "message_type": "check_in",
            "start_time": ts.timestamp(),
            "project_id": self.project.id,
            "payload": json.dumps(payload).encode(),
            "sdk": "test/1.0",
            "retention_days": 90,
        }

        with self.check_processing_errors(wrapper, None, None):
            self.consumer.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"fake-key", msgpack.packb(wrapper), []),
                        self.partition,
                        1,
                        item_ts,
                    )
                )
            )
        return guid

    @contextlib.contextmanager
    def check_processing_errors(
        self,
        expected_checkin: CheckIn,
        expected_error: ProcessingErrorsException | ExpectNoProcessingError | None,
        expected_monitor_slug: str | None,
    ) -> Generator:
        if expected_error is None:
            yield None
            return

        with mock.patch(
            "sentry.monitors.consumers.monitor_consumer.handle_processing_errors"
        ) as handle_processing_errors:
            yield

            args_list = handle_processing_errors.call_args_list
            if isinstance(expected_error, ExpectNoProcessingError):
                assert len(args_list) == 0
                return

            assert len(args_list) == 1

            checkin_item, error = args_list[0][0]
            expected_checkin_item = CheckinItem(
                datetime.fromtimestamp(expected_checkin["start_time"]),
                self.partition.index,
                expected_checkin,
                json.loads(expected_checkin["payload"]),
            )
            if expected_monitor_slug:
                expected_error.monitor = Monitor.objects.get(
                    project_id=expected_checkin["project_id"], slug=expected_monitor_slug
                )
            assert checkin_item == expected_checkin_item
            assert error.monitor == expected_error.monitor
            assert error.processing_errors == expected_error.processing_errors

    def init(self, checkin_margin=1, max_runtime=1):
        self.time = timezone.now().replace(second=0, microsecond=0)
        self.time_delta = timedelta(minutes=1)
        self.broker: LocalBroker[KafkaPayload] = LocalBroker(MemoryMessageStorage())

        self.clock_tick_topic = Topic("monitors-clock-tick")
        self.clock_tasks_topic = Topic("monitors-clock-tasks")

        self.broker.create_topic(self.clock_tick_topic, partitions=1)
        self.broker.create_topic(self.clock_tasks_topic, partitions=1)

        self.consumer = create_consumer()
        self.partition = partition

        # Setup one monitor which should be marked as missed, and one check-in that
        # should be marked as timed-out
        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": checkin_margin,
                "max_runtime": max_runtime,
            },
        )

        self.monitor_environment = MonitorEnvironment.objects.ensure_environment(
            self.project, self.monitor, "production"
        )

        self.monitor_environment.status = MonitorStatus.OK
        self.monitor_environment.last_checkin = self.time
        self.monitor_environment.next_checkin = self.time + self.time_delta
        self.monitor_environment.next_checkin_latest = self.time + self.time_delta * 2
        self.monitor_environment.save()

        self.producer = self.broker.get_producer()
        self.tick_consumer = self.broker.get_consumer("monitors-clock-tick")
        self.tasks_consumer = self.broker.get_consumer("monitors-clock-tasks")
        self.tick_processor = StreamProcessor(
            consumer=self.tick_consumer,
            topic=self.clock_tick_topic,
            processor_factory=MonitorClockTickStrategyFactory(),
            commit_policy=ONCE_PER_SECOND,
        )

        self.task_processor = StreamProcessor(
            consumer=self.tasks_consumer,
            topic=self.clock_tasks_topic,
            processor_factory=MonitorClockTasksStrategyFactory(),
            commit_policy=ONCE_PER_SECOND,
        )

    def tick_clock(self, delta: timedelta | None = None):
        if delta is None:
            delta = self.time_delta
        self.time = self.time + delta
        # Dispatch a clock tick
        with mock.patch(
            "sentry.monitors.clock_dispatch._clock_tick_producer",
            self.producer,
        ):
            try_monitor_clock_tick(self.time, 0)

        # Process the tick. This will produce two tasks, one for the missed
        # check-in and one for the timed-out check-in. This will produce two
        # tasks, one for the missed check-in and one for the timed-out check-in
        with mock.patch(
            "sentry.monitors.clock_tasks.producer._clock_task_producer",
            self.producer,
        ):
            self.tick_processor._run_once()

        # process the two tasks
        self.task_processor._run_once()
        self.task_processor._run_once()

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_two_in_progress_timeout(self) -> None:
        self.init()

        self.send_checkin("in_progress")

        self.tick_clock()

        self.send_checkin("in_progress")

        self.tick_clock(timedelta(seconds=59))

        self.monitor_environment.refresh_from_db()

        checkins = list(MonitorCheckIn.objects.filter(monitor_environment=self.monitor_environment))
        checkins.sort(key=lambda checkin: checkin.id)

        assert checkins[0].status == CheckInStatus.TIMEOUT
        assert checkins[1].status == CheckInStatus.IN_PROGRESS
        assert self.monitor_environment.status == MonitorStatus.ERROR

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_timeout_followed_by_checkin(self) -> None:
        self.init()

        self.send_checkin("in_progress")

        self.tick_clock()

        guid = self.send_checkin("in_progress")

        self.tick_clock(timedelta(seconds=1))

        self.send_checkin("ok", guid)

        self.tick_clock(timedelta(seconds=59))

        self.monitor_environment.refresh_from_db()

        checkins = list(MonitorCheckIn.objects.filter(monitor_environment=self.monitor_environment))
        checkins.sort(key=lambda checkin: checkin.id)

        assert len(checkins) == 2
        assert checkins[0].status == CheckInStatus.TIMEOUT
        assert checkins[1].status == CheckInStatus.OK
        assert self.monitor_environment.status == MonitorStatus.OK

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_late_ok_followed_by_timeout(self) -> None:
        self.init(1, 2)

        first_guid = self.send_checkin("in_progress")

        self.tick_clock()

        self.send_checkin("in_progress")

        self.tick_clock(timedelta(seconds=59))

        self.send_checkin("ok", first_guid)

        self.monitor_environment.refresh_from_db()

        checkins = list(MonitorCheckIn.objects.filter(monitor_environment=self.monitor_environment))
        checkins.sort(key=lambda checkin: checkin.id)

        assert len(checkins) == 2
        assert checkins[0].status == CheckInStatus.OK
        assert checkins[1].status == CheckInStatus.IN_PROGRESS
        assert self.monitor_environment.status == MonitorStatus.OK

    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_late_ok_followed_by_missed(self) -> None:
        self.init(1, 3)

        first_guid = self.send_checkin("in_progress")

        self.tick_clock()

        self.tick_clock()

        self.tick_clock(timedelta(seconds=59))

        self.send_checkin("ok", first_guid)

        self.monitor_environment.refresh_from_db()

        checkins = list(MonitorCheckIn.objects.filter(monitor_environment=self.monitor_environment))
        checkins.sort(key=lambda checkin: checkin.id)

        assert len(checkins) == 2
        assert checkins[0].status == CheckInStatus.OK
        assert checkins[1].status == CheckInStatus.MISSED
        assert self.monitor_environment.status == MonitorStatus.OK
