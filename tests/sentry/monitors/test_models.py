from datetime import datetime

import pytest
from django.conf import settings
from django.test.utils import override_settings
from django.utils import timezone

from sentry.monitors.models import (
    Monitor,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorLimitsExceeded,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.validators import ConfigValidator
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class MonitorTestCase(TestCase):
    def test_next_run_crontab(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": None,
                "max_runtime": None,
            }
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 12, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 16, tzinfo=timezone.utc
        )

    def test_next_run_latest_crontab_with_margin(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "* * * * *",
                "checkin_margin": 5,
                "max_runtime": None,
            }
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )
        assert monitor_environment.monitor.get_next_expected_checkin_latest(ts) == datetime(
            2019, 1, 1, 1, 16, tzinfo=timezone.utc
        )

    def test_next_run_crontab_with_timezone(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={
                "schedule_type": ScheduleType.CRONTAB,
                "schedule": "0 12 * * *",
                "timezone": "UTC",
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 1, 1, 12, 00, tzinfo=timezone.utc
        )

        # Europe/Berlin == UTC+01:00.
        # the run should be represented 1 hours earlier in UTC time
        monitor.config["timezone"] = "Europe/Berlin"
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 1, 1, 11, 00, tzinfo=timezone.utc
        )

    def test_next_run_interval(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute.
        assert monitor_environment.monitor.get_next_expected_checkin(ts) == datetime(
            2019, 2, 1, 1, 10, 0, tzinfo=timezone.utc
        )

    def test_save_defaults_slug_to_name(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
        )

        assert monitor.slug == "my-awesome-monitor"

    def test_save_defaults_slug_unique(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            slug="my-awesome-monitor",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
        )

        assert monitor.slug == "my-awesome-monitor"

        # Create another monitor with the same name
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="My Awesome Monitor",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
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
                config={
                    "schedule": [1, "month"],
                    "schedule_type": ScheduleType.INTERVAL,
                    "checkin_margin": None,
                    "max_runtime": None,
                },
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
                config={
                    "schedule": [1, "month"],
                    "schedule_type": ScheduleType.INTERVAL,
                    "checkin_margin": None,
                    "max_runtime": None,
                },
            )


@region_silo_test
class MonitorEnvironmentTestCase(TestCase):
    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            name="Unicron",
            slug="unicron",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
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
                "checkin_margin": None,
                "max_runtime": None,
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
            "checkin_margin": None,
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
