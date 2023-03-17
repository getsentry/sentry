import uuid
from datetime import datetime, timedelta
from typing import Any, Dict
from unittest import mock

import msgpack
import pytest
from arroyo.backends.kafka import KafkaPayload
from arroyo.types import BrokerValue, Message, Partition, Topic
from django.utils import timezone

from sentry.monitors.consumers.check_in import StoreMonitorCheckInStrategyFactory, _process_message
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
    def get_message(self, monitor_slug: str, **overrides: Any) -> Dict[str, Any]:
        now = datetime.now()
        self.guid = uuid.uuid4().hex
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
            next_checkin=timezone.now() + timedelta(minutes=1),
            type=MonitorType.CRON_JOB,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
            **kwargs,
        )

    def valid_wrapper(self):
        return {
            "start_time": datetime.now().timestamp(),
            "project_id": self.project.id,
            "payload": self.valid_payload(),
        }

    def valid_payload(self, **overrides: Any):
        self.guid_2 = uuid.uuid4().hex
        payload = {
            "monitor_slug": "my-monitor",
            "status": "ok",
            "duration": None,
            "check_in_id": self.guid_2,
            "environment": "production",
        }
        payload.update(overrides)
        return json.dumps(payload)

    def test_payload(self) -> None:
        monitor = self._create_monitor(slug="my-monitor")

        commit = mock.Mock()
        partition = Partition(Topic("test"), 0)
        StoreMonitorCheckInStrategyFactory().create_with_partitions(commit, {partition: 0}).submit(
            Message(
                BrokerValue(
                    KafkaPayload(b"fake-key", msgpack.packb(self.valid_wrapper()), []),
                    partition,
                    1,
                    datetime.now(),
                )
            )
        )

        checkin = MonitorCheckIn.objects.get(guid=self.guid_2)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

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

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

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

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.ERROR
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ERROR
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_disabled(self):
        monitor = self._create_monitor(status=MonitorStatus.DISABLED)
        message = self.get_message(monitor.slug, status="error")
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.ERROR

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.DISABLED
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.DISABLED
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )

    @pytest.mark.django_db
    def test_check_in_update(self):
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(monitor.slug)
        _process_message(message)
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.duration is not None

    @pytest.mark.django_db
    def test_monitor_environment(self):
        monitor = self._create_monitor(slug="my-monitor")
        message = self.get_message(monitor.slug, environment="jungle")
        _process_message(message)

        checkin = MonitorCheckIn.objects.get(guid=self.guid)
        assert checkin.status == CheckInStatus.OK

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK
        assert monitor.last_checkin == checkin.date_added
        assert monitor.next_checkin == monitor.get_next_scheduled_checkin(checkin.date_added)

        monitor_environment = MonitorEnvironment.objects.get(id=checkin.monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        assert monitor_environment.environment.name == "jungle"
        assert monitor_environment.last_checkin == checkin.date_added
        assert monitor_environment.next_checkin == monitor.get_next_scheduled_checkin(
            checkin.date_added
        )
