import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from unittest import mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.conf import settings
from django.test.utils import override_settings

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.monitors.consumers.monitor_consumer import (
    StoreMonitorCheckInStrategyFactory,
    _process_message,
)
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


class MonitorConsumerTest(TestCase):
    def get_message(
        self, monitor_slug: str, guid: Optional[str] = None, **overrides: Any
    ) -> Dict[str, Any]:
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
        }

        return wrapper

    def _create_monitor(self, **kwargs):
        return Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": "* * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
            },
            **kwargs,
        )

    def get_valid_wrapper(self, monitor_slug: str) -> Dict[str, Any]:
        return {
            "start_time": datetime.now().timestamp(),
            "project_id": self.project.id,
            "payload": self.valid_payload(monitor_slug),
        }

    def valid_payload(self, monitor_slug: str) -> str:
        self.message_guid = uuid.uuid4().hex
        payload = {
            "monitor_slug": monitor_slug,
            "status": "ok",
            "duration": None,
            "check_in_id": self.message_guid,
            "environment": "production",
        }
        return json.dumps(payload)

    def send_message(self, wrapper: Dict[str, Any]) -> None:
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

        self.send_message(self.get_valid_wrapper(monitor.slug))

        checkin = MonitorCheckIn.objects.get(guid=self.message_guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_passing(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(monitor.slug)
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_failing(self):
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(monitor.slug, status="error")
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_disabled(self):
        monitor = self._create_monitor(status=ObjectStatus.DISABLED)
        message = self.get_message(monitor.slug, status="error")
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)

        # The created monitor environment is active, but the parent monitor is
        # disabled
        assert monitor_environment.status == MonitorStatus.ACTIVE
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_check_in_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        _process_message(self.get_message(monitor.slug, status="in_progress"))
        _process_message(self.get_message(monitor.slug, guid=self.guid))

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration is not None

    @pytest.mark.django_db
    def test_check_in_update_terminal(self):
        monitor = self._create_monitor(slug="my-monitor")
        done_message = self.get_message(monitor.slug, duration=10.0)
        _process_message(done_message)
        _process_message(self.get_message(monitor.slug, guid=self.guid, status="in_progress"))

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(10.0 * 1000)

        error_message = self.get_message(monitor.slug, duration=20.0, status="error")
        _process_message(error_message)
        _process_message(self.get_message(monitor.slug, guid=self.guid, status="in_progress"))

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration == int(20.0 * 1000)

    @pytest.mark.django_db
    def test_monitor_environment(self):
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(monitor.slug, environment="jungle")
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.environment.name == "jungle"
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_monitor_create(self):
        message = self.get_message(
            "my-new-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
        )
        _process_message(message)

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

    @pytest.mark.django_db
    def test_monitor_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
        )
        _process_message(message)

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

    def test_rate_limit(self):
        monitor = self._create_monitor(slug="my-monitor")

        with mock.patch("sentry.monitors.consumers.monitor_consumer.CHECKIN_QUOTA_LIMIT", 1):
            # Try to ingest two the second will be rate limited
            _process_message(self.get_message("my-monitor"))
            _process_message(self.get_message("my-monitor"))

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 1

            # Same monitor, diff environments
            _process_message(self.get_message("my-monitor", environment="dev"))

            checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
            assert len(checkins) == 2

    def test_invalid_duration(self):
        monitor = self._create_monitor(slug="my-monitor")

        # Try to ingest two the second will be rate limited
        message = self.get_message("my-monitor", status="in_progress")
        check_in_id = message.get("check_in_id")
        _process_message(message)

        # Invalid check-in updates
        _process_message(
            self.get_message("my-monitor", check_in_id=check_in_id, duration=-(1.0 / 1000))
        )
        _process_message(
            self.get_message(
                "my-monitor",
                check_in_id=check_in_id,
                duration=((BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000),
            )
        )

        # Invalid check-in creations
        _process_message(self.get_message("my-monitor", duration=-(1.0 / 1000)))
        _process_message(
            self.get_message(
                "my-monitor", duration=(BoundedPositiveIntegerField.MAX_VALUE + 1.0) / 1000
            )
        )

        # Only one check-in should be processed and it should still be IN_PROGRESS
        checkins = MonitorCheckIn.objects.filter(monitor_id=monitor.id)
        assert len(checkins) == 1
        assert checkins[0].status == CheckInStatus.IN_PROGRESS

    @pytest.mark.django_db
    def test_monitor_upsert(self):
        message = self.get_message(
            "my-monitor",
            monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            environment="my-environment",
        )
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        monitor_environment = MonitorEnvironment.objects.get(
            monitor=monitor, environment__name="my-environment"
        )
        assert monitor_environment is not None

    @override_settings(MAX_MONITORS_PER_ORG=2)
    @pytest.mark.django_db
    def test_monitor_limits(self):
        for i in range(settings.MAX_MONITORS_PER_ORG + 2):
            message = self.get_message(
                f"my-monitor-{i}",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
            )
            _process_message(message)

        monitors = Monitor.objects.filter(organization_id=self.organization.id)
        assert len(monitors) == settings.MAX_MONITORS_PER_ORG

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    @pytest.mark.django_db
    def test_monitor_environment_limits(self):
        for i in range(settings.MAX_ENVIRONMENTS_PER_MONITOR + 2):
            message = self.get_message(
                "my-monitor",
                monitor_config={"schedule": {"type": "crontab", "value": "13 * * * *"}},
                environment=f"my-environment-{i}",
            )
            _process_message(message)

        monitor = Monitor.objects.get(slug="my-monitor")
        assert monitor is not None

        monitor_environments = MonitorEnvironment.objects.filter(monitor=monitor)
        assert len(monitor_environments) == settings.MAX_ENVIRONMENTS_PER_MONITOR
