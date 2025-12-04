import logging
from datetime import datetime, timezone
from unittest import mock

import pytest
from django.conf import settings
from django.test.utils import override_settings

from sentry.monitors.models import (
    CronMonitorDataSourceHandler,
    Monitor,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorLimitsExceeded,
    ScheduleType,
    is_monitor_muted,
)
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.validators import ConfigValidator
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataSource


class MonitorTestCase(TestCase):
    def test_next_run_crontab(self) -> None:
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

    def test_next_run_latest_crontab_with_margin(self) -> None:
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

    def test_next_run_crontab_with_timezone(self) -> None:
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

    def test_next_run_interval(self) -> None:
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

    def test_save_defaults_slug_to_name(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="My Awesome Monitor",
            config={
                "schedule": [1, "month"],
                "schedule_type": ScheduleType.INTERVAL,
                "checkin_margin": None,
                "max_runtime": None,
            },
        )

        assert monitor.slug == "my-awesome-monitor"

    def test_save_defaults_slug_unique(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
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
    def test_monitor_organization_limit(self) -> None:
        for i in range(settings.MAX_MONITORS_PER_ORG):
            Monitor.objects.create(
                organization_id=self.organization.id,
                project_id=self.project.id,
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
                name=f"Unicron-{settings.MAX_MONITORS_PER_ORG}",
                slug=f"unicron-{settings.MAX_MONITORS_PER_ORG}",
                config={
                    "schedule": [1, "month"],
                    "schedule_type": ScheduleType.INTERVAL,
                    "checkin_margin": None,
                    "max_runtime": None,
                },
            )


class MonitorEnvironmentTestCase(TestCase):
    @override_settings(MAX_ENVIRONMENTS_PER_MONITOR=2)
    def test_monitor_environment_limits(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
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

    def test_update_config(self) -> None:
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
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

    def test_config_validator(self) -> None:
        config = {
            "checkin_margin": None,
            "max_runtime": None,
            "schedule": [1, "month"],
            "schedule_type": ScheduleType.INTERVAL,
            "alert_rule_id": 1,
        }
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Unicron",
            slug="unicron",
            config=config,
        )
        validated_config = monitor.get_validated_config()
        assert validated_config == config

        validated_config["bad_key"] = 100
        monitor.config = validated_config

        with self.assertLogs(logger="root", level=logging.WARNING) as cm:
            bad_config = monitor.get_validated_config()
            assert bad_config == validated_config
            assert bad_config["bad_key"] == 100

        assert len(cm.records) == 1
        assert "invalid config" in cm.records[0].message

    def test_build_occurrence_fingerprint(self):
        """Test that build_occurrence_fingerprint returns the expected format"""
        monitor = self.create_monitor()
        monitor_environment = self.create_monitor_environment(
            monitor=monitor,
            environment_id=self.environment.id,
        )
        fingerprint = monitor_environment.build_occurrence_fingerprint()
        assert fingerprint == f"crons:{monitor_environment.id}"

    def test_build_occurrence_fingerprint_different_environments(self):
        """Test that different MonitorEnvironments get different fingerprints"""
        monitor = self.create_monitor()
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        monitor_env1 = self.create_monitor_environment(
            monitor=monitor,
            environment_id=env1.id,
        )
        monitor_env2 = self.create_monitor_environment(
            monitor=monitor,
            environment_id=env2.id,
        )
        fingerprint1 = monitor_env1.build_occurrence_fingerprint()
        fingerprint2 = monitor_env2.build_occurrence_fingerprint()
        assert fingerprint1 != fingerprint2
        assert fingerprint1 == f"crons:{monitor_env1.id}"
        assert fingerprint2 == f"crons:{monitor_env2.id}"

    def test_ensure_environment_matches_monitor_muted_state(self):
        """Test that new environments match the monitor's computed is_muted state.

        When creating a new environment, it will be muted if the monitor's is_muted
        property returns True (i.e., all existing environments are muted).
        """
        # Create monitor with all existing environments muted
        muted_monitor = self.create_monitor()
        # Create first environment as muted
        self.create_monitor_environment(
            monitor=muted_monitor,
            environment_id=self.environment.id,
            is_muted=True,
        )

        # New environment matches the monitor's computed muted state (all envs muted = True)
        muted_env = MonitorEnvironment.objects.ensure_environment(
            self.project, muted_monitor, "production"
        )
        assert muted_env.is_muted is True

        # Test with monitor that has no muted environments
        unmuted_monitor = self.create_monitor()
        unmuted_env = MonitorEnvironment.objects.ensure_environment(
            self.project, unmuted_monitor, "staging"
        )
        assert unmuted_env.is_muted is False


class CronMonitorDataSourceHandlerTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.monitor = self.create_monitor(
            project=self.project,
            name="Test Monitor",
        )

        self.data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(self.monitor.id),
            organization_id=self.organization.id,
        )

    def test_bulk_get_query_object(self) -> None:
        result = CronMonitorDataSourceHandler.bulk_get_query_object([self.data_source])
        assert result[self.data_source.id] == self.monitor

    def test_bulk_get_query_object__multiple_monitors(self) -> None:
        monitor2 = self.create_monitor(
            project=self.project,
            name="Test Monitor 2",
        )
        data_source2 = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id=str(monitor2.id),
            organization_id=self.organization.id,
        )

        data_sources = [self.data_source, data_source2]
        result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

        assert result[self.data_source.id] == self.monitor
        assert result[data_source2.id] == monitor2

    def test_bulk_get_query_object__incorrect_data_source(self) -> None:
        ds_with_invalid_monitor_id = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id="not_an_int",
            organization_id=self.organization.id,
        )

        with mock.patch("sentry.monitors.models.logger.exception") as mock_logger:
            data_sources = [self.data_source, ds_with_invalid_monitor_id]
            result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

            assert result[self.data_source.id] == self.monitor
            assert result[ds_with_invalid_monitor_id.id] is None

            mock_logger.assert_called_once_with(
                "Invalid DataSource.source_id fetching Monitor",
                extra={
                    "id": ds_with_invalid_monitor_id.id,
                    "source_id": ds_with_invalid_monitor_id.source_id,
                },
            )

    def test_bulk_get_query_object__missing_monitor(self) -> None:
        ds_with_deleted_monitor = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            source_id="99999999",
            organization_id=self.organization.id,
        )

        data_sources = [self.data_source, ds_with_deleted_monitor]
        result = CronMonitorDataSourceHandler.bulk_get_query_object(data_sources)

        assert result[self.data_source.id] == self.monitor
        assert result[ds_with_deleted_monitor.id] is None

    def test_bulk_get_query_object__empty_list(self) -> None:
        result = CronMonitorDataSourceHandler.bulk_get_query_object([])
        assert result == {}

    def test_related_model(self) -> None:
        relations = CronMonitorDataSourceHandler.related_model(self.data_source)
        assert len(relations) == 1
        relation = relations[0]

        assert relation.params["model"] == Monitor
        assert relation.params["query"] == {"id": self.data_source.source_id}

    def test_get_instance_limit(self) -> None:
        assert CronMonitorDataSourceHandler.get_instance_limit(self.organization) is None

    def test_get_current_instance_count(self) -> None:
        with pytest.raises(NotImplementedError):
            CronMonitorDataSourceHandler.get_current_instance_count(self.organization)


class MonitorIsMutedPropertyTestCase(TestCase):
    """Test the is_muted computed property for Monitor."""

    def test_is_muted_all_environments_muted(self):
        """Test that monitor.is_muted returns True when all environments are muted."""
        monitor = self.create_monitor()
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        # Create two muted environments
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env1.id,
            is_muted=True,
        )
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env2.id,
            is_muted=True,
        )

        # Verify monitor.is_muted is True
        assert is_monitor_muted(monitor) is True

    def test_is_muted_some_environments_unmuted(self):
        """Test that monitor.is_muted returns False when any environment is unmuted."""
        monitor = self.create_monitor()
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        # Create one muted and one unmuted environment
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env1.id,
            is_muted=True,
        )
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env2.id,
            is_muted=False,
        )

        # Verify monitor.is_muted is False
        assert is_monitor_muted(monitor) is False

    def test_is_muted_all_environments_unmuted(self):
        """Test that monitor.is_muted returns False when all environments are unmuted."""
        monitor = self.create_monitor()
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        # Create two unmuted environments
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env1.id,
            is_muted=False,
        )
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env2.id,
            is_muted=False,
        )

        # Verify monitor.is_muted is False
        assert is_monitor_muted(monitor) is False

    def test_is_muted_no_environments(self):
        """Test that monitor.is_muted returns False when there are no environments."""
        monitor = self.create_monitor()
        assert is_monitor_muted(monitor) is False

    def test_is_muted_single_environment(self):
        """Test is_muted works correctly with a single environment."""
        # Test with muted environment
        monitor = self.create_monitor()
        env = self.create_environment(name="production")
        self.create_monitor_environment(
            monitor=monitor,
            environment_id=env.id,
            is_muted=True,
        )

        assert is_monitor_muted(monitor) is True

        # Test with unmuted environment
        monitor2 = self.create_monitor()
        env2 = self.create_environment(name="staging")
        self.create_monitor_environment(
            monitor=monitor2,
            environment_id=env2.id,
            is_muted=False,
        )

        assert is_monitor_muted(monitor2) is False
