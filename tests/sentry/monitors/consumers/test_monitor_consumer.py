import contextlib
import uuid
from collections.abc import Generator, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.processing.strategies import ProcessingStrategy
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.conf import settings
from django.test.utils import override_settings
from rest_framework.exceptions import ErrorDetail
from sentry_kafka_schemas.schema_types.ingest_monitors_v1 import CheckIn

from sentry import audit_log, killswitches
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.models.environment import Environment
from sentry.monitors.constants import TIMEOUT, PermitCheckInStatus
from sentry.monitors.consumers.monitor_consumer import StoreMonitorCheckInStrategyFactory
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.processing_errors.errors import ProcessingErrorsException, ProcessingErrorType
from sentry.monitors.types import CheckinItem
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.utils import json
from sentry.utils.outcomes import Outcome


class ExpectNoProcessingError:
    pass


class MonitorConsumerTest(TestCase):
    def setUp(self):
        super().setUp()
        self.partition = Partition(Topic("test"), 0)

    def _create_monitor(self, **kwargs):
        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
                "max_runtime": None,
            },
            **kwargs,
        )

    def create_consumer(self, factory_opts: Mapping | None = None):
        if factory_opts is None:
            factory_opts = {}

        factory = StoreMonitorCheckInStrategyFactory(**factory_opts)
        commit = mock.Mock()
        return factory.create_with_partitions(commit, {self.partition: 0})

    def send_checkin(
        self,
        monitor_slug: str,
        guid: str | None = None,
        ts: datetime | None = None,
        item_ts: datetime | None = None,
        consumer: ProcessingStrategy | None = None,
        expected_error: ProcessingErrorsException | ExpectNoProcessingError | None = None,
        expected_monitor_slug: str | None = None,
        **overrides: Any,
    ) -> None:
        if ts is None:
            ts = datetime.now()
        if item_ts is None:
            item_ts = ts
        if consumer is None:
            consumer = self.create_consumer()

        self.guid = uuid.uuid4().hex if not guid else guid
        self.trace_id = uuid.uuid4().hex

        payload = {
            "monitor_slug": monitor_slug,
            "status": "ok",
            "check_in_id": self.guid,
            "environment": "production",
            "contexts": {"trace": {"trace_id": self.trace_id}},
        }
        payload.update(overrides)

        wrapper: CheckIn = {
            "message_type": "check_in",
            "start_time": ts.timestamp(),
            "project_id": self.project.id,
            "payload": json.dumps(payload).encode(),
            "sdk": "test/1.0",
            "retention_days": 90,
        }

        with self.check_processing_errors(wrapper, expected_error, expected_monitor_slug):
            consumer.submit(
                Message(
                    BrokerValue(
                        KafkaPayload(b"fake-key", msgpack.packb(wrapper), []),
                        self.partition,
                        1,
                        item_ts,
                    )
                )
            )

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

    def send_clock_pulse(
        self,
        ts: datetime | None = None,
        consumer: ProcessingStrategy | None = None,
    ) -> None:
        if ts is None:
            ts = datetime.now()
        if consumer is None:
            consumer = self.create_consumer()

        wrapper = {"message_type": "clock_pulse"}

        consumer.submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"fake-key", msgpack.packb(wrapper), []),
                    self.partition,
                    1,
                    ts,
                )
            )
        )

    def test_payload(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")

        self.send_checkin(monitor.slug)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.monitor_config == monitor.config

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_expected_checkin(
            checkin.date_added
        )
        assert monitor_environment.next_checkin_latest == monitor.get_next_expected_checkin_latest(
            checkin.date_added
        )

        # Process another check-in to verify we set an expected time for the next check-in
        self.send_checkin(monitor.slug)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.expected_time == monitor_environment.next_checkin
        assert checkin.trace_id.hex == self.trace_id

    @mock.patch("sentry.monitors.consumers.monitor_consumer.process_checkin_group")
    def test_parallel(self, process_checkin_group) -> None:
        """
        Validates that the consumer in parallel mode correctly groups check-ins
        into groups by their monitor slug / environment
        """
        factory = StoreMonitorCheckInStrategyFactory(
            mode="batched-parallel",
            max_batch_size=4,
            max_workers=1,
        )
        commit = mock.Mock()
        consumer = factory.create_with_partitions(commit, {self.partition: 0})

        monitor_1 = self._create_monitor(slug="my-monitor-1")
        monitor_2 = self._create_monitor(slug="my-monitor-2")

        # Send 4 check-ins to fill the batch
        self.send_checkin(monitor_1.slug, consumer=consumer)
        self.send_checkin(monitor_2.slug, consumer=consumer)
        self.send_checkin(monitor_2.slug, consumer=consumer)
        self.send_checkin(monitor_2.slug, environment="test", consumer=consumer)

        # Send one more check-in to cause the batch to be processed
        self.send_checkin(monitor_1.slug, consumer=consumer)

        # Because we have two separate monitor slugs and one separate
        # environment, there will be three groups of check-ins to process
        assert process_checkin_group.call_count == 3

        group_1: Sequence[CheckinItem] = process_checkin_group.mock_calls[0].args[0]
        group_2: Sequence[CheckinItem] = process_checkin_group.mock_calls[1].args[0]
        group_3: Sequence[CheckinItem] = process_checkin_group.mock_calls[2].args[0]

        # Each group has the correct number of check-ins
        assert len(group_1) == 1
        assert len(group_2) == 2
        assert len(group_3) == 1

        assert all(checkin.payload["monitor_slug"] == monitor_1.slug for checkin in group_1)
        assert all(checkin.payload["monitor_slug"] == monitor_2.slug for checkin in group_2)

        # The last group is monitor_2 but with a diff environment
        assert group_3[0].payload.get("environment") == "test"

    def test_passing(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.monitor_config == monitor.config

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_expected_checkin(
            checkin.date_added
        )
        assert monitor_environment.next_checkin_latest == monitor.get_next_expected_checkin_latest(
            checkin.date_added
        )

        # Process another check-in to verify we set an expected time for the next check-in
        self.send_checkin(monitor.slug)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        # the expected time should not include the margin of 5 minutes
        assert checkin.expected_time == monitor_environment.next_checkin

    def test_failing(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="error")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_expected_checkin(
            checkin.date_added
        )
        assert monitor_environment.next_checkin_latest == monitor.get_next_expected_checkin_latest(
            checkin.date_added
        )

    def test_muted(self):
        monitor = self._create_monitor(is_muted=True)
        self.send_checkin(monitor.slug, status="error")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)

        # The created monitor environment is in line with the check-in, but the
        # parent monitor is muted
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_expected_checkin(
            checkin.date_added
        )
        assert monitor_environment.next_checkin_latest == monitor.get_next_expected_checkin_latest(
            checkin.date_added
        )

    def test_check_in_date_clock(self):
        monitor = self._create_monitor(slug="my-monitor")
        now = datetime.now()
        item_ts = now
        ts = now + timedelta(seconds=5)

        self.send_checkin(monitor.slug, ts=ts, item_ts=item_ts)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.date_added == ts.replace(tzinfo=UTC)
        assert checkin.date_clock == item_ts.replace(tzinfo=UTC)

    def test_check_in_timeout_at(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        timeout_at = checkin.date_added.replace(second=0, microsecond=0) + timedelta(
            minutes=TIMEOUT
        )
        assert checkin.timeout_at == timeout_at

        self.send_checkin(monitor.slug, guid=self.guid)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.timeout_at is None

        new_guid = uuid.uuid4().hex
        self.send_checkin(
            "my-other-monitor",
            guid=new_guid,
            status="in_progress",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "max_runtime": 5,
            },
            environment="my-environment",
        )

        checkin = MonitorCheckIn.objects.get(guid=new_guid)
        timeout_at = checkin.date_added.replace(second=0, microsecond=0) + timedelta(minutes=5)
        assert checkin.timeout_at == timeout_at

    def test_check_in_timeout_late(self):
        monitor = self._create_monitor(slug="my-monitor")
        now = datetime.now()
        self.send_checkin(monitor.slug, status="in_progress", ts=now)

        # mark monitor as timed-out
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        checkin.update(status=CheckInStatus.TIMEOUT)

        assert checkin.duration is None

        # next check-in reports an OK
        self.send_checkin(monitor.slug, guid=self.guid, ts=now + timedelta(seconds=5))

        # The check-in is still in TIMEOUT status, but has a duration now
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.TIMEOUT
        assert checkin.duration == 5000

    def test_check_in_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="in_progress")
        self.send_checkin(monitor.slug, guid=self.guid)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration is not None

    def test_check_in_update_with_reversed_dates(self):
        monitor = self._create_monitor(slug="my-monitor")
        now = datetime.now()
        self.send_checkin(monitor.slug, status="in_progress", ts=now)
        self.send_checkin(monitor.slug, guid=self.guid, ts=now - timedelta(seconds=5))

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.duration == 5000

    def test_check_in_existing_guid(self):
        monitor = self._create_monitor(slug="my-monitor")
        other_monitor = self._create_monitor(slug="other-monitor")

        self.send_checkin(monitor.slug, status="in_progress")
        self.send_checkin(
            monitor.slug, guid=self.guid, status="done", enviroment="other-environment"
        )
        self.send_checkin(other_monitor.slug, guid=self.guid, status="done")

        # Assert check-in was not modified
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.IN_PROGRESS

    def test_check_in_update_terminal_in_progress(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, duration=10.0)
        self.send_checkin(
            monitor.slug,
            guid=self.guid,
            status="in_progress",
            expected_error=ExpectNoProcessingError(),
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(10.0 * 1000)

        self.send_checkin(monitor.slug, duration=20.0, status="error")
        self.send_checkin(
            monitor.slug,
            guid=self.guid,
            status="in_progress",
            expected_error=ExpectNoProcessingError(),
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(20.0 * 1000)

    def test_check_in_update_terminal_user_terminal(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, duration=10.0)
        self.send_checkin(monitor.slug, guid=self.guid, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(10.0 * 1000)

        self.send_checkin(monitor.slug, duration=20.0, status="error")
        self.send_checkin(
            monitor.slug,
            guid=self.guid,
            status="ok",
            expected_error=ProcessingErrorsException(
                [{"type": ProcessingErrorType.CHECKIN_FINISHED}], monitor
            ),
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(20.0 * 1000)

    def test_monitor_environment(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, environment="jungle")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.get_environment().name == "jungle"
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_expected_checkin(
            checkin.date_added
        )
        assert monitor_environment.next_checkin_latest == monitor.get_next_expected_checkin_latest(
            checkin.date_added
        )

    def test_monitor_create(self):
        self.send_checkin(
            "my-new-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.monitor.name == "my-new-monitor"
        assert monitor_environment.get_environment().name == "production"
        assert monitor_environment.last_checkin == checkin.date_added
        assert (
            monitor_environment.next_checkin
            == monitor_environment.monitor.get_next_expected_checkin(checkin.date_added)
        )
        assert (
            monitor_environment.next_checkin_latest
            == monitor_environment.monitor.get_next_expected_checkin_latest(checkin.date_added)
        )

    def test_monitor_create_owner(self):
        self.send_checkin(
            "my-new-monitor",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "owner": f"user:{self.user.id}",
            },
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        monitor = monitor_environment.monitor
        assert monitor.name == "my-new-monitor"
        assert monitor.owner_user_id == self.user.id
        assert "owner" not in monitor.config

    def test_monitor_create_owner_invalid(self):
        bad_user = self.create_user()
        self.send_checkin(
            "my-new-monitor",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "owner": f"user:{bad_user.id}",
            },
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = checkin.monitor_environment
        assert monitor_environment.status == MonitorStatus.OK
        monitor = monitor_environment.monitor
        assert monitor.name == "my-new-monitor"
        assert monitor.owner_user_id is None
        assert "owner" not in monitor.config

    def test_monitor_update_owner(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(
            "my-monitor",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "owner": f"user:{self.user.id}",
            },
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        monitor.refresh_from_db()
        assert monitor.owner_user_id == self.user.id
        assert "owner" not in monitor.config

    def test_monitor_update_owner_to_team(self):
        monitor = self._create_monitor(slug="my-monitor", owner_user_id=self.user.id)
        self.send_checkin(
            "my-monitor",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "owner": f"team:{self.team.id}",
            },
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        monitor.refresh_from_db()
        assert monitor.owner_user_id is None
        assert monitor.owner_team_id == self.team.id
        assert "owner" not in monitor.config

    def test_monitor_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule"] == "13 * * * *"
        # The monitor config is merged, so checkin_margin is not overwritten
        assert monitor.config["checkin_margin"] == 5

        monitor_environment = checkin.monitor_environment
        assert checkin.monitor_environment.status == MonitorStatus.OK
        assert checkin.monitor_environment.last_checkin == checkin.date_added
        assert (
            monitor_environment.next_checkin
            == monitor_environment.monitor.get_next_expected_checkin(checkin.date_added)
        )
        assert (
            monitor_environment.next_checkin_latest
            == monitor_environment.monitor.get_next_expected_checkin_latest(checkin.date_added)
        )

    def test_check_in_empty_id(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(
            "my-monitor",
            guid=str(uuid.UUID(int=0)),
        )

        checkin = MonitorCheckIn.objects.get(monitor=monitor)
        assert checkin.status == CheckInStatus.OK
        assert checkin.guid.int != 0

    def test_check_in_empty_id_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(
            "my-monitor",
            status="in_progress",
            guid=str(uuid.UUID(int=0)),
        )

        open_checkin = MonitorCheckIn.objects.get(monitor=monitor)
        assert open_checkin.status == CheckInStatus.IN_PROGRESS
        assert open_checkin.guid != uuid.UUID(int=0)

        # Send an event to a different monitor environment, tests that when we
        # use the empty UUID "latest" we properly scope to the latest of the
        # same monitor environment
        self.send_checkin("my-monitor", status="in_progress", environment="dev")

        self.send_checkin(
            "my-monitor",
            status="ok",
            guid=str(uuid.UUID(int=0)),
        )

        closed_checkin = MonitorCheckIn.objects.get(guid=open_checkin.guid)
        assert closed_checkin.status == CheckInStatus.OK
        assert closed_checkin.guid != uuid.UUID(int=0)

    def test_rate_limit(self):
        now = datetime.now()
        monitor = self._create_monitor(slug="my-monitor")

        with mock.patch("sentry.monitors.consumers.monitor_consumer.CHECKIN_QUOTA_LIMIT", 1):
            # Try to ingest two the second will be rate limited
            self.send_checkin("my-monitor", ts=now)
            self.send_checkin(
                "my-monitor",
                ts=now,
                expected_error=ProcessingErrorsException(
                    [{"type": ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED}]
                ),
            )

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 1

            # Same monitor, diff environments
            self.send_checkin("my-monitor", environment="dev", ts=now)

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 2

            # Same monitor same env but a minute later, shuld NOT be rate-limited
            self.send_checkin("my-monitor", ts=now + timedelta(minutes=1))

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 3

    def test_invalid_guid_environment_match(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.monitor_environment.get_environment().name == "production"

        self.send_checkin(
            monitor.slug,
            guid=self.guid,
            status="ok",
            environment="test",
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH,
                        "existingEnvironment": "production",
                    }
                ],
                monitor,
            ),
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.IN_PROGRESS
        assert checkin.monitor_environment.get_environment().name != "test"

    def test_invalid_duration(self):
        monitor = self._create_monitor(slug="my-monitor")

        # Test invalid explicit durations
        self.send_checkin("my-monitor", status="in_progress")

        # Invalid check-in updates
        self.send_checkin(
            "my-monitor",
            guid=self.guid,
            duration=-(1.0 / 1000),
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED,
                        "errors": {
                            "duration": [
                                ErrorDetail(
                                    string="Ensure this value is greater than or equal to 0.",
                                    code="min_value",
                                )
                            ]
                        },
                    }
                ],
            ),
        )
        self.send_checkin(
            "my-monitor",
            guid=self.guid,
            duration=((BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000),
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED,
                        "errors": {
                            "duration": [
                                ErrorDetail(
                                    string="Ensure this value is less than or equal to 2147483647.",
                                    code="max_value",
                                )
                            ]
                        },
                    }
                ],
            ),
        )

        # Invalid check-in creations
        self.send_checkin(
            "my-monitor",
            duration=-(1.0 / 1000),
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED,
                        "errors": {
                            "duration": [
                                ErrorDetail(
                                    string="Ensure this value is greater than or equal to 0.",
                                    code="min_value",
                                )
                            ]
                        },
                    }
                ],
            ),
        )
        self.send_checkin(
            "my-monitor",
            duration=(BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000,
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.CHECKIN_VALIDATION_FAILED,
                        "errors": {
                            "duration": [
                                ErrorDetail(
                                    string="Ensure this value is less than or equal to 2147483647.",
                                    code="max_value",
                                )
                            ]
                        },
                    }
                ],
            ),
        )

        # Only one check-in should be processed and it should still be IN_PROGRESS
        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 1
        assert checkins[0].status == CheckInStatus.IN_PROGRESS

        # Test invalid implicit duration
        old_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=MonitorEnvironment.objects.get(monitor=monitor),
            project_id=self.project.id,
            status=CheckInStatus.IN_PROGRESS,
            date_added=monitor.date_added - timedelta(weeks=52),
        )

        self.send_checkin("my-monitor", guid=old_checkin.guid)

        checkin = MonitorCheckIn.objects.get(guid=old_checkin.guid)
        assert checkin.status == CheckInStatus.IN_PROGRESS
        assert checkin.duration is None

    def test_monitor_upsert(self):
        self.send_checkin(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            environment="my-environment",
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        env = Environment.objects.get(
            organization_id=monitor.organization_id, name="my-environment"
        )
        assert MonitorEnvironment.objects.filter(monitor=monitor, environment_id=env.id).exists()

    def test_monitor_upsert_empty_timezone(self):
        self.send_checkin(
            "my-monitor",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "timezone": "",
            },
            environment="my-environment",
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None
        assert "timezone" not in monitor.config

    def test_monitor_upsert_invalid_slug(self):
        self.send_checkin(
            "some/slug@with-weird|stuff",
            monitor_config={"schedule": {"type": "crontab", "value": "0 * * * *"}},
        )

        # invalid slug is slugified
        monitor = Monitor.objects.get(slug="someslugwith-weirdstuff")
        assert monitor is not None

    def test_monitor_upsert_checkin_margin_zero(self):
        """
        As part of GH-56526 we changed the minimum value allowed for the
        checkin_margin to 1 from 0. Some monitors may still be upserting with a
        0 set, we transform it to None in those cases.
        """
        self.send_checkin(
            "invalid-monitor-checkin",
            monitor_config={
                "schedule": {"type": "crontab", "value": "13 * * * *"},
                "checkin_margin": 0,
            },
            environment="my-environment",
        )

        monitor = Monitor.objects.filter(slug="invalid-monitor-checkin")
        assert monitor.exists()
        assert monitor[0].config["checkin_margin"] == 1

    def test_monitor_invalid_config(self):
        # 6 value schedule
        self.send_checkin(
            "my-invalid-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * * *"}},
            environment="my-environment",
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.MONITOR_INVALID_CONFIG,
                        "errors": {
                            "schedule": [
                                ErrorDetail(
                                    string="Only 5 field crontab syntax is supported",
                                    code="invalid",
                                )
                            ]
                        },
                    },
                    {
                        "type": ProcessingErrorType.MONITOR_NOT_FOUND,
                    },
                ],
            ),
        )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

        # no next valid check-in
        self.send_checkin(
            "my-invalid-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "* * 31 2 *"}},
            environment="my-environment",
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.MONITOR_INVALID_CONFIG,
                        "errors": {
                            "schedule": [ErrorDetail(string="Schedule is invalid", code="invalid")]
                        },
                    },
                    {
                        "type": ProcessingErrorType.MONITOR_NOT_FOUND,
                    },
                ],
            ),
        )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_limits(self):
        for i in range(settings.MAX_MONITORS_PER_ORG + 2):
            expected_error = None
            if i > settings.MAX_MONITORS_PER_ORG:
                expected_error = ProcessingErrorsException(
                    [
                        {
                            "type": ProcessingErrorType.MONITOR_LIMIT_EXCEEDED,
                            "reason": f"You may not exceed {settings.MAX_MONITORS_PER_ORG} monitors per organization",
                        }
                    ]
                )
            self.send_checkin(
                f"my-monitor-{i}",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                expected_error=expected_error,
            )

        monitors = Monitor.objects.filter(organization_id=self.organization.id)
        assert len(monitors) == settings.MAX_MONITORS_PER_ORG

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self):
        monitor_slug = "my-monitor"
        for i in range(settings.MAX_ENVIRONMENTS_PER_MONITOR + 2):
            expected_error = None
            if i > settings.MAX_ENVIRONMENTS_PER_MONITOR:
                expected_error = ProcessingErrorsException(
                    [
                        {
                            "type": ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED,
                            "reason": f"You may not exceed {settings.MAX_ENVIRONMENTS_PER_MONITOR} environments per monitor",
                        }
                    ],
                )
            self.send_checkin(
                monitor_slug,
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                environment=f"my-environment-{i}",
                expected_error=expected_error,
                expected_monitor_slug=monitor_slug,
            )

        monitor = Monitor.objects.get(slug=monitor_slug)
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == settings.MAX_ENVIRONMENTS_PER_MONITOR

    def test_monitor_environment_validation(self):
        invalid_name = "x" * 65
        monitor_slug = "my-monitor"

        self.send_checkin(
            monitor_slug,
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            environment=f"my-environment-{invalid_name}",
            expected_error=ProcessingErrorsException(
                [
                    {
                        "type": ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT,
                        "reason": "Environment name too long",
                    }
                ]
            ),
            expected_monitor_slug=monitor_slug,
        )

        monitor = Monitor.objects.get(slug=monitor_slug)
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == 0

    def test_monitor_disabled(self):
        monitor = self._create_monitor(status=ObjectStatus.DISABLED, slug="my-monitor")
        self.send_checkin(
            "my-monitor",
            expected_error=ProcessingErrorsException(
                [{"type": ProcessingErrorType.MONITOR_DISABLED}],
                monitor,
            ),
        )

        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 0

    def test_organization_killswitch(self):
        monitor = self._create_monitor(slug="my-monitor")

        opt_val = killswitches.validate_user_input(
            "crons.organization.disable-check-in", [{"organization_id": self.organization.id}]
        )

        with self.options({"crons.organization.disable-check-in": opt_val}):
            self.send_checkin(
                monitor.slug,
                expected_error=ProcessingErrorsException(
                    [{"type": ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED}]
                ),
            )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

    @mock.patch("sentry.monitors.consumers.monitor_consumer.update_check_in_volume")
    def test_monitor_update_check_in_volumne(self, update_check_in_volume):
        monitor = self._create_monitor(slug="my-monitor")

        self.send_checkin(monitor.slug)
        assert update_check_in_volume.call_count == 1

    @mock.patch("sentry.monitors.consumers.monitor_consumer.try_monitor_clock_tick")
    def test_monitor_tasks_trigger(self, try_monitor_clock_tick):
        monitor = self._create_monitor(slug="my-monitor")

        now = datetime.now().replace(second=0, microsecond=0)

        # First checkin triggers tasks
        self.send_checkin(monitor.slug)
        assert try_monitor_clock_tick.call_count == 1

        # A clock pulse message also triggers the tasks
        self.send_clock_pulse()
        assert try_monitor_clock_tick.call_count == 2

        # An exception dispatching the tasks does NOT cause ingestion to fail
        with mock.patch("sentry.monitors.consumers.monitor_consumer.logger") as logger:
            try_monitor_clock_tick.side_effect = Exception()
            self.send_checkin(monitor.slug, ts=now + timedelta(minutes=5))
            assert MonitorCheckIn.objects.filter(guid=self.guid).exists()
            logger.exception.assert_called_with("Failed to trigger monitor tasks")
            try_monitor_clock_tick.side_effect = None

    @mock.patch("sentry.monitors.consumers.monitor_consumer.update_check_in_volume")
    def test_parallel_monitor_update_check_in_volume(self, update_check_in_volume):
        factory = StoreMonitorCheckInStrategyFactory(mode="parallel", max_batch_size=4)
        commit = mock.Mock()
        consumer = factory.create_with_partitions(commit, {self.partition: 0})

        monitor = self._create_monitor(slug="my-monitor")

        now = datetime.now().replace(second=5)

        # Send enough check-ins to process the batch
        self.send_checkin(monitor.slug, consumer=consumer, ts=now)
        self.send_checkin(monitor.slug, consumer=consumer, ts=now + timedelta(seconds=10))
        self.send_checkin(monitor.slug, consumer=consumer, ts=now + timedelta(seconds=30))
        self.send_checkin(monitor.slug, consumer=consumer, ts=now + timedelta(minutes=1))

        # One final check-in will trigger the batch to process (but will not
        # yet be processed itself)
        self.send_checkin(monitor.slug, consumer=consumer, ts=now + timedelta(minutes=2))

        assert update_check_in_volume.call_count == 1
        assert list(update_check_in_volume.call_args_list[0][0][0]) == [
            now,
            now + timedelta(seconds=10),
            now + timedelta(seconds=30),
            now + timedelta(minutes=1),
        ]

    @mock.patch("sentry.monitors.consumers.monitor_consumer.try_monitor_clock_tick")
    def test_parallel_monitor_task_triggers(self, try_monitor_clock_tick):
        factory = StoreMonitorCheckInStrategyFactory(mode="parallel", max_batch_size=4)
        commit = mock.Mock()
        consumer = factory.create_with_partitions(commit, {self.partition: 0})

        monitor = self._create_monitor(slug="my-monitor")

        # First checkin does NOT trigger task since we're batching
        self.send_checkin(monitor.slug, consumer=consumer)
        assert try_monitor_clock_tick.call_count == 0

        # Sending 3 messages (including a clock pulse)
        self.send_checkin(monitor.slug, consumer=consumer)
        self.send_clock_pulse(consumer=consumer)
        self.send_checkin(monitor.slug, consumer=consumer)

        # One more check-in to process the batch
        self.send_checkin(monitor.slug, consumer=consumer)

        assert try_monitor_clock_tick.call_count == 1

    @mock.patch("sentry.quotas.backend.check_accept_monitor_checkin")
    def test_monitor_quotas_accept(self, check_accept_monitor_checkin):
        check_accept_monitor_checkin.return_value = PermitCheckInStatus.ACCEPT

        # Explicitly leaving off the "disabled" status to validate that we're
        # not dropping due to the monitor being disabled
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug)

        check_accept_monitor_checkin.assert_called_with(self.project.id, monitor.slug)

        checkin = MonitorCheckIn.objects.get(monitor_id=monitor.id)
        assert checkin.status == CheckInStatus.OK

    @mock.patch("sentry.quotas.backend.check_accept_monitor_checkin")
    def test_monitor_quotas_drop(self, check_accept_monitor_checkin):
        check_accept_monitor_checkin.return_value = PermitCheckInStatus.DROP

        # Explicitly leaving off the "disabled" status to validate that we're
        # not dropping due to the monitor being disabled
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(
            monitor.slug,
            expected_error=ProcessingErrorsException(
                [{"type": ProcessingErrorType.MONITOR_OVER_QUOTA}],
            ),
        )

        check_accept_monitor_checkin.assert_called_with(self.project.id, monitor.slug)

        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 0

    @mock.patch("sentry.quotas.backend.assign_monitor_seat")
    @mock.patch("sentry.quotas.backend.check_accept_monitor_checkin")
    def test_monitor_accept_upsert_with_seat(
        self,
        check_accept_monitor_checkin,
        assign_monitor_seat,
    ):
        """
        Validates that a monitor can be upserted and processes a full check-in
        when the PermitCheckInStatus is ACCEPTED_FOR_UPSERT and a seat is
        allocated with a Outcome.ACCEPTED.
        """
        check_accept_monitor_checkin.return_value = PermitCheckInStatus.ACCEPTED_FOR_UPSERT
        assign_monitor_seat.return_value = Outcome.ACCEPTED

        with outbox_runner():
            self.send_checkin(
                "my-monitor",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                environment="my-environment",
            )

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        check_accept_monitor_checkin.assert_called_with(self.project.id, monitor.slug)
        assign_monitor_seat.assert_called_with(monitor)

        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MONITOR_ADD"),
            data={"upsert": True, **monitor.get_audit_log_data()},
        )

    @mock.patch("sentry.quotas.backend.assign_monitor_seat")
    @mock.patch("sentry.quotas.backend.check_accept_monitor_checkin")
    def test_monitor_accept_upsert_no_seat(
        self,
        check_accept_monitor_checkin,
        assign_monitor_seat,
    ):
        """
        Validates that a monitor can be upserted but have the check-in dropped
        when the PermitCheckInStatus is ACCEPTED_FOR_UPSERT and a seat is
        unable to be allocated with a Outcome.RATE_LIMITED
        """
        check_accept_monitor_checkin.return_value = PermitCheckInStatus.ACCEPTED_FOR_UPSERT
        assign_monitor_seat.return_value = Outcome.RATE_LIMITED

        self.send_checkin(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            environment="my-environment",
            expected_error=ProcessingErrorsException(
                [{"type": ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA}]
            ),
            expected_monitor_slug="my-monitor",
        )

        # Check-in was not produced as we could not assign a monitor seat
        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

        # Monitor was created, but is disabled
        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None
        assert monitor.status == ObjectStatus.DISABLED

        check_accept_monitor_checkin.assert_called_with(self.project.id, monitor.slug)
        assign_monitor_seat.assert_called_with(monitor)

    @mock.patch("sentry.quotas.backend.assign_monitor_seat")
    @mock.patch("sentry.quotas.backend.check_accept_monitor_checkin")
    def test_monitor_accept_upsert_existing_monitor(
        self,
        check_accept_monitor_checkin,
        assign_monitor_seat,
    ):
        """
        Validate the unusual casse where a seat does not already exist but a
        monitor does exist. We should ensure assign_monitor_seat is called
        """
        check_accept_monitor_checkin.return_value = PermitCheckInStatus.ACCEPTED_FOR_UPSERT
        assign_monitor_seat.return_value = Outcome.RATE_LIMITED

        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin("my-monitor", environment="my-environment")

        # Check-in was not produced as we could not assign a monitor seat
        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

        # Monitor was created, but is disabled
        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None
        assert monitor.status == ObjectStatus.DISABLED

        check_accept_monitor_checkin.assert_called_with(self.project.id, monitor.slug)
        assign_monitor_seat.assert_called_with(monitor)
