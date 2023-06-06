import uuid
from datetime import datetime, timedelta
from typing import Any, Optional
from unittest import mock

import msgpack
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.conf import settings
from django.test.utils import override_settings

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
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
from sentry.testutils import TestCase
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

    def send_message(
        self,
        monitor_slug: str,
        guid: Optional[str] = None,
        **overrides: Any,
    ) -> None:
        now = datetime.now()
        self.guid = uuid.uuid4().hex if not guid else guid

        payload = {
            "monitor_slug": monitor_slug,
            "status": "ok",
            "duration": None,
            "check_in_id": self.guid,
            "environment": "production",
        }
        payload.update(overrides)

        wrapper = {
            "start_time": now.timestamp(),
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
                    datetime.now(),
                )
            )
        )

    def test_payload(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")

        self.send_message(monitor.slug)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.monitor_config == monitor.config

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

        # Process another check-in to verify we set an expected time for the next check-in
        expected_time = monitor_environment.next_checkin
        self.send_message(monitor.slug)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        # the expected time should not include the margin of 5 minutes
        assert checkin.expected_time == expected_time - timedelta(minutes=5)

    def test_passing(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(monitor.slug)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK
        assert checkin.monitor_config == monitor.config

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

        # Process another check-in to verify we set an expected time for the next check-in
        expected_time = monitor_environment.next_checkin
        self.send_message(monitor.slug)
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        # the expected time should not include the margin of 5 minutes
        assert checkin.expected_time == expected_time - timedelta(minutes=5)

    def test_failing(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(monitor.slug, status="error")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    def test_disabled(self):
        monitor = self._create_monitor(status=ObjectStatus.DISABLED)
        self.send_message(monitor.slug, status="error")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)

        # The created monitor environment is in line with the check-in, but the parent monitor
        # is disabled
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    def test_create_lock(self):
        monitor = self._create_monitor(slug="my-monitor")
        guid = uuid.uuid4().hex

        lock = locks.get(f"checkin-creation:{uuid.UUID(guid)}", duration=2, name="checkin_creation")
        lock.acquire()

        self.send_message(monitor.slug, guid=guid)

        # Lock should prevent creation of new check-in
        assert len(MonitorCheckIn.objects.filter(monitor=monitor)) == 0

    def test_check_in_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(monitor.slug, status="in_progress")
        self.send_message(monitor.slug, guid=self.guid)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration is not None

    def test_check_in_existing_guid(self):
        monitor = self._create_monitor(slug="my-monitor")
        other_monitor = self._create_monitor(slug="other-monitor")

        self.send_message(monitor.slug, status="in_progress")
        self.send_message(
            monitor.slug, guid=self.guid, status="done", enviroment="other-environment"
        )
        self.send_message(other_monitor.slug, guid=self.guid, status="done")

        # Assert check-in was not modified
        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.IN_PROGRESS

    def test_check_in_update_terminal(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(monitor.slug, duration=10.0)
        self.send_message(monitor.slug, guid=self.guid, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(10.0 * 1000)

        self.send_message(monitor.slug, duration=20.0, status="error")
        self.send_message(monitor.slug, guid=self.guid, status="in_progress")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(20.0 * 1000)

    def test_monitor_environment(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(monitor.slug, environment="jungle")

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.environment.name == "jungle"
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    def test_monitor_create(self):
        self.send_message(
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
            == monitor_environment.monitor.get_next_scheduled_checkin(checkin.date_added)
        )

    def test_monitor_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(
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
            == monitor_environment.monitor.get_next_scheduled_checkin(checkin.date_added)
        )

    def test_check_in_empty_id(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(
            "my-monitor",
            guid=str(uuid.UUID(int=0)),
        )

        checkin = MonitorCheckIn.objects.get(monitor=monitor)
        assert checkin.status == CheckInStatus.OK
        assert checkin.guid.int != 0

    def test_check_in_empty_id_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        self.send_message(
            "my-monitor",
            status="in_progress",
            guid=str(uuid.UUID(int=0)),
        )

        open_checkin = MonitorCheckIn.objects.get(monitor=monitor)
        assert open_checkin.status == CheckInStatus.IN_PROGRESS
        assert open_checkin.guid != uuid.UUID(int=0)

        self.send_message(
            "my-monitor",
            status="ok",
            guid=str(uuid.UUID(int=0)),
        )

        close_checkin = MonitorCheckIn.objects.get(guid=open_checkin.guid)
        assert close_checkin.status == CheckInStatus.OK
        assert close_checkin.guid != uuid.UUID(int=0)

    def test_rate_limit(self):
        monitor = self._create_monitor(slug="my-monitor")

        with mock.patch("sentry.monitors.consumers.monitor_consumer.CHECKIN_QUOTA_LIMIT", 1):
            # Try to ingest two the second will be rate limited
            self.send_message("my-monitor")
            self.send_message("my-monitor")

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 1

            # Same monitor, diff environments
            self.send_message("my-monitor", environment="dev")

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 2

    def test_invalid_duration(self):
        monitor = self._create_monitor(slug="my-monitor")

        # Try to ingest two the second will be rate limited
        self.send_message("my-monitor", status="in_progress")

        # Invalid check-in updates
        self.send_message("my-monitor", guid=self.guid, duration=-(1.0 / 1000))
        self.send_message(
            "my-monitor",
            guid=self.guid,
            duration=((BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000),
        )

        # Invalid check-in creations
        self.send_message("my-monitor", duration=-(1.0 / 1000))
        self.send_message(
            "my-monitor", duration=(BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000
        )

        # Only one check-in should be processed and it should still be IN_PROGRESS
        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 1
        assert checkins[0].status == CheckInStatus.IN_PROGRESS

    def test_monitor_upsert(self):
        self.send_message(
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

    def test_monitor_invalid_config(self):
        self.send_message(
            "my-invalid-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * * *"}},
            environment="my-environment",
        )

        assert not MonitorCheckIn.objects.filter(guid=self.guid).exists()

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_limits(self):
        for i in range(settings.MAX_MONITORS_PER_ORG + 2):
            self.send_message(
                f"my-monitor-{i}",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            )

        monitors = Monitor.objects.filter(organization_id=self.organization.id)
        assert len(monitors) == settings.MAX_MONITORS_PER_ORG

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self):
        for i in range(settings.MAX_ENVIRONMENTS_PER_MONITOR + 2):
            self.send_message(
                "my-monitor",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                environment=f"my-environment-{i}",
            )

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == settings.MAX_ENVIRONMENTS_PER_MONITOR
