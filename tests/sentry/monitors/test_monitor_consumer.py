import uuid
from datetime import datetime, timedelta
from typing import Any, Optional
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.conf import settings
from django.test.utils import override_settings

from sentry import killswitches
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.monitors.constants import TIMEOUT
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
from sentry.testutils.cases import TestCase
from sentry.utils import json
from sentry.utils.locking.manager import LockManager
from sentry.utils.services import build_instance_from_options

locks = LockManager(build_instance_from_options(settings.SENTRY_POST_PROCESS_LOCKS_BACKEND_OPTIONS))


class MonitorConsumerTest(TestCase):
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

    def send_checkin(
        self,
        monitor_slug: str,
        guid: Optional[str] = None,
        ts: Optional[datetime] = None,
        **overrides: Any,
    ) -> None:
        if ts is None:
            ts = datetime.now()

        self.guid = uuid.uuid4().hex if not guid else guid
        self.trace_id = uuid.uuid4().hex

        payload = {
            "monitor_slug": monitor_slug,
            "status": "ok",
            "duration": None,
            "check_in_id": self.guid,
            "environment": "production",
            "contexts": {"trace": {"trace_id": self.trace_id}},
        }
        payload.update(overrides)

        wrapper = {
            "message_type": "check_in",
            "start_time": ts.timestamp(),
            "project_id": self.project.id,
            "payload": json.dumps(payload),
            "sdk": "test/1.0",
        }

        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        StoreMonitorCheckInStrategyFactory().create_with_partitions(commit, {partition: 0}).submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"fake-key", msgpack.packb(wrapper), []),
                    partition,
                    1,
                    ts,
                )
            )
        )

    def send_clock_pulse(
        self,
        ts: Optional[datetime] = None,
    ) -> None:
        if ts is None:
            ts = datetime.now()

        wrapper = {"message_type": "clock_pulse"}

        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        StoreMonitorCheckInStrategyFactory().create_with_partitions(commit, {partition: 0}).submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"fake-key", msgpack.packb(wrapper), []),
                    partition,
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

    def test_check_in_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="in_progress")
        self.send_checkin(monitor.slug, guid=self.guid)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration is not None

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

    def test_check_in_update_terminal(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, duration=10.0)
        self.send_checkin(monitor.slug, guid=self.guid, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(10.0 * 1000)

        self.send_checkin(monitor.slug, duration=20.0, status="error")
        self.send_checkin(monitor.slug, guid=self.guid, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(20.0 * 1000)

    def test_monitor_environment(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, environment="jungle")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.environment.name == "jungle"
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
        assert monitor_environment.environment.name == "production"
        assert monitor_environment.last_checkin == checkin.date_added
        assert (
            monitor_environment.next_checkin
            == monitor_environment.monitor.get_next_expected_checkin(checkin.date_added)
        )
        assert (
            monitor_environment.next_checkin_latest
            == monitor_environment.monitor.get_next_expected_checkin_latest(checkin.date_added)
        )

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

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
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
        monitor = self._create_monitor(slug="my-monitor")

        with mock.patch("sentry.monitors.consumers.monitor_consumer.CHECKIN_QUOTA_LIMIT", 1):
            # Try to ingest two the second will be rate limited
            self.send_checkin("my-monitor")
            self.send_checkin("my-monitor")

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 1

            # Same monitor, diff environments
            self.send_checkin("my-monitor", environment="dev")

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 2

    def test_invalid_guid_environment_match(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_checkin(monitor.slug, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.monitor_environment.environment.name == "production"

        self.send_checkin(monitor.slug, guid=self.guid, status="ok", environment="test")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.IN_PROGRESS
        assert checkin.monitor_environment.environment.name != "test"

    def test_invalid_duration(self):
        monitor = self._create_monitor(slug="my-monitor")

        # Test invalid explicit durations
        self.send_checkin("my-monitor", status="in_progress")

        # Invalid check-in updates
        self.send_checkin("my-monitor", guid=self.guid, duration=-(1.0 / 1000))
        self.send_checkin(
            "my-monitor",
            guid=self.guid,
            duration=((BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000),
        )

        # Invalid check-in creations
        self.send_checkin("my-monitor", duration=-(1.0 / 1000))
        self.send_checkin(
            "my-monitor", duration=(BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000
        )

        # Only one check-in should be processed and it should still be IN_PROGRESS
        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 1
        assert checkins[0].status == CheckInStatus.IN_PROGRESS

        # Test invalid implicit duration
        old_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=MonitorEnvironment.objects.filter(monitor=monitor).first(),
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

        monitor_environment = MonitorEnvironment.objects.get(
            monitor=monitor, environment__name="my-environment"
        )
        assert monitor_environment is not None

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
        )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

        # no next valid check-in
        self.send_checkin(
            "my-invalid-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "* * 31 2 *"}},
            environment="my-environment",
        )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_limits(self):
        for i in range(settings.MAX_MONITORS_PER_ORG + 2):
            self.send_checkin(
                f"my-monitor-{i}",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            )

        monitors = Monitor.objects.filter(organization_id=self.organization.id)
        assert len(monitors) == settings.MAX_MONITORS_PER_ORG

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self):
        for i in range(settings.MAX_ENVIRONMENTS_PER_MONITOR + 2):
            self.send_checkin(
                "my-monitor",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                environment=f"my-environment-{i}",
            )

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == settings.MAX_ENVIRONMENTS_PER_MONITOR

    def test_monitor_environment_validation(self):
        invalid_name = "x" * 65

        self.send_checkin(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            environment=f"my-environment-{invalid_name}",
        )

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == 0

    def test_monitor_disabled(self):
        monitor = self._create_monitor(status=ObjectStatus.DISABLED, slug="my-monitor")
        self.send_checkin("my-monitor")

        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 0

    def test_organization_killswitch(self):
        monitor = self._create_monitor(slug="my-monitor")

        opt_val = killswitches.validate_user_input(
            "crons.organization.disable-check-in", [{"organization_id": self.organization.id}]
        )

        with self.options({"crons.organization.disable-check-in": opt_val}):
            self.send_checkin(monitor.slug)

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

    @mock.patch("sentry.monitors.consumers.monitor_consumer.try_monitor_tasks_trigger")
    def test_monitor_tasks_trigger(self, try_monitor_tasks_trigger):
        monitor = self._create_monitor(slug="my-monitor")

        now = datetime.now().replace(second=0, microsecond=0)

        # First checkin triggers tasks
        self.send_checkin(monitor.slug)
        assert try_monitor_tasks_trigger.call_count == 1

        # A clock pulse message also triggers the tasks
        self.send_clock_pulse()
        assert try_monitor_tasks_trigger.call_count == 2

        # An exception dispatching the tasks does NOT cause ingestion to fail
        with mock.patch("sentry.monitors.consumers.monitor_consumer.logger") as logger:
            try_monitor_tasks_trigger.side_effect = Exception()
            self.send_checkin(monitor.slug, ts=now + timedelta(minutes=5))
            assert MonitorCheckIn.objects.filter(guid=self.guid).exists()
            logger.exception.assert_called_with("Failed to trigger monitor tasks")
            try_monitor_tasks_trigger.side_effect = None
