from datetime import datetime
from unittest.mock import patch

import pytest
from django.conf import settings
from django.test.utils import override_settings
from django.utils import timezone

from sentry.monitors.logic.mark_failed import mark_failed
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorLimitsExceeded,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.validators import ConfigValidator
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorTestCase(TestCase):
    def test_next_run_crontab_implicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(config={"schedule": "* * * * *"})
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit_timezone(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={
                "schedule": "0 12 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "timezone": "UTC",
            },
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 12, 00, tzinfo=timezone.utc
        )

        # Europe/Berlin == UTC+01:00.
        # the run should be represented 1 hours earlier in UTC time
        monitor.config["timezone"] = "Europe/Berlin"
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 11, 00, tzinfo=timezone.utc
        )

    def test_next_run_interval(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute.
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 2, 1, 1, 10, 0, tzinfo=timezone.utc
        )

    def test_save_defaults_slug_to_name(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        assert monitor.slug == "my-awesome-monitor"

    def test_save_defaults_slug_unique(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            slug="my-awesome-monitor",
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        assert monitor.slug == "my-awesome-monitor"

        # Create another monitor with the same name
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        assert monitor.slug.startswith("my-awesome-monitor-")

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_organization_limit(self):
        for i in range(settings.MAX_MONITORS_PER_ORG):
            Monitor.objects.create(
                organization_id=self.organization.id,
                project_id=self.project.id,
                type=MonitorType.CRON_JOB,
                name=f"Unicron-{i}",
                slug=f"unicron-{i}",
                config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
            )

        with pytest.raises(
            MonitorLimitsExceeded,
            match=f"You may not exceed {settings.MAX_MONITORS_PER_ORG} monitors per organization",
        ):
            Monitor.objects.create(
                organization_id=self.organization.id,
                project_id=self.project.id,
                type=MonitorType.CRON_JOB,
                name=f"Unicron-{settings.MAX_MONITORS_PER_ORG}",
                slug=f"unicron-{settings.MAX_MONITORS_PER_ORG}",
                config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
            )


@region_silo_test(stable=True)
class MonitorEnvironmentTestCase(TestCase):
    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_ok_recovery_threshold(self, mock_produce_occurrence_to_kafka):
        recovery_threshold = 8
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "recovery_threshold": recovery_threshold,
            },
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=MonitorStatus.ERROR,
            last_state_change=None,
        )

        MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )

        for i in range(0, recovery_threshold - 1):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
            )
            monitor_environment.mark_ok(checkin, checkin.date_added)

        # failure has not hit threshold, monitor should be in an OK status
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status != MonitorStatus.OK
        # check that timestamp has not updated
        assert monitor_environment.last_state_change is None

        # create another failed check-in to break the chain
        failed_checkin = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.ERROR,
        )
        mark_failed(monitor_environment, failed_checkin.date_added)
        # assert occurrence was sent
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        for i in range(0, recovery_threshold):
            checkin = MonitorCheckIn.objects.create(
                monitor=monitor,
                monitor_environment=monitor_environment,
                project_id=self.project.id,
                status=CheckInStatus.OK,
            )
            monitor_environment.mark_ok(checkin, checkin.date_added)

        # recovery has hit threshold, monitor should be in an ok state
        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.OK
        # check that monitor environment has updated timestamp used for fingerprinting
        assert monitor_environment.last_state_change == monitor_environment.last_checkin

    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="Unicron",
            slug="unicron",
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        for i in range(settings.MAX_ENVIRONMENTS_PER_MONITOR):
            MonitorEnvironment.objects.ensure_environment(self.project, monitor, f"space-{i}")

        with pytest.raises(
            MonitorEnvironmentLimitsExceeded,
            match=f"You may not exceed {settings.MAX_ENVIRONMENTS_PER_MONITOR} environments per monitor",
        ):
            MonitorEnvironment.objects.ensure_environment(
                self.project, monitor, f"space-{settings.MAX_ENVIRONMENTS_PER_MONITOR}"
            )

    def test_update_config(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="Unicron",
            slug="unicron",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "alert_rule_id": 1,
            },
        )

        new_config = {
            "schedule": {
                "type": "crontab",
                "value": "0 0 1 2 *",
            },
            "max_runtime": 10,
            "garbage": "data",
        }
        validator = ConfigValidator(data=new_config)
        assert validator.is_valid()
        validated_config = validator.validated_data
        monitor.update_config(new_config, validated_config)

        assert monitor.config == {
            "schedule": "0 0 1 2 *",
            "schedule_type": ScheduleType.CRONTAB,
            "max_runtime": 10,
            "alert_rule_id": 1,
        }

    def test_config_validator(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="Unicron",
            slug="unicron",
            config={
                "checkin_margin": None,
                "max_runtime": None,
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "alert_rule_id": 1,
            },
        )
        validated_config = monitor.get_validated_config()
        assert validated_config is not None

        # Check to make sure bad config fails validation
        validated_config["bad_key"] = 100
        monitor.config = validated_config
        assert monitor.get_validated_config() is None
