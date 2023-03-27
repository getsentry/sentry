from datetime import datetime
from unittest.mock import patch

from django.utils import timezone

from sentry.models import Environment
from sentry.monitors.models import (
    Monitor,
    MonitorEnvironment,
    MonitorFailure,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorTestCase(TestCase):
    def test_next_run_crontab_implicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(last_checkin=ts, config={"schedule": "* * * * *"})
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            last_checkin=ts,
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit_timezone(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            last_checkin=ts,
            config={
                "schedule": "0 12 * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "timezone": "UTC",
            },
        )
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 12, 00, tzinfo=timezone.utc
        )

        # Europe/Berlin == UTC+01:00.
        # the run should be represented 1 hours earlier in UTC time
        monitor.config["timezone"] = "Europe/Berlin"
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 1, 1, 11, 00, tzinfo=timezone.utc
        )

    def test_next_run_interval(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            last_checkin=ts,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.get_next_scheduled_checkin(ts) == datetime(
            2019, 2, 1, 1, 10, 20, tzinfo=timezone.utc
        )

    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_default_params(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.mark_failed()

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "active",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (unknown)"},
                "fingerprint": ["monitor", str(monitor.guid), "unknown"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_reason(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.mark_failed(reason=MonitorFailure.DURATION)

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "active",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (duration)"},
                "fingerprint": ["monitor", str(monitor.guid), "duration"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_missed_reason(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        assert monitor.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)

        monitor.refresh_from_db()
        assert monitor.status == MonitorStatus.MISSED_CHECKIN

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "platform": "other",
                "contexts": {
                    "monitor": {
                        "status": "active",
                        "type": "cron_job",
                        "config": {"schedule_type": 2, "schedule": [1, "month"]},
                        "id": str(monitor.guid),
                        "name": monitor.name,
                        "slug": monitor.slug,
                    }
                },
                "logentry": {"formatted": "Monitor failure: test monitor (missed_checkin)"},
                "fingerprint": ["monitor", str(monitor.guid), "missed_checkin"],
                "logger": "",
                "type": "default",
            },
        ) == dict(event)

    def test_save_defaults_slug_to_guid(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        assert str(monitor.guid) == monitor.slug

    def test_save_defaults_slug_to_guid_only_on_create(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        original_monitor_guid = monitor.guid

        # Simulate existing monitors entries that don't have a slug set
        monitor.slug = ""
        monitor.name = "New name"
        monitor.save()

        assert monitor.guid == original_monitor_guid


@region_silo_test(stable=True)
class MonitorEnvironmentTestCase(TestCase):
    def test_monitor_environment(self):
        project = self.project
        environment = Environment.get_or_create(project, "production")

        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )

        production_monitor = MonitorEnvironment.objects.create(
            monitor=monitor, environment=environment
        )

        assert type(production_monitor) == MonitorEnvironment
