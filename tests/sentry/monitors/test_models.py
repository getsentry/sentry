from datetime import datetime
from unittest.mock import patch

import pytest
from django.conf import settings
from django.test.utils import override_settings
from django.utils import timezone

from sentry.grouping.utils import hash_from_values
from sentry.issues.grouptype import (
    MonitorCheckInFailure,
    MonitorCheckInMissed,
    MonitorCheckInTimeout,
)
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorEnvironmentLimitsExceeded,
    MonitorFailure,
    MonitorLimitsExceeded,
    MonitorStatus,
    MonitorType,
    ScheduleType,
)
from sentry.monitors.validators import ConfigValidator
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorTestCase(TestCase):
    def test_next_run_crontab_implicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(config={"schedule": "* * * * *"})
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
            2019, 1, 1, 1, 15, tzinfo=timezone.utc
        )

    def test_next_run_crontab_explicit(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={"schedule": "* * * * *", "schedule_type": ScheduleType.CRONTAB},
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
            2019, 1, 1, 1, 11, tzinfo=timezone.utc
        )

        monitor.config["schedule"] = "*/5 * * * *"
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
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
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
            2019, 1, 1, 12, 00, tzinfo=timezone.utc
        )

        # Europe/Berlin == UTC+01:00.
        # the run should be represented 1 hours earlier in UTC time
        monitor.config["timezone"] = "Europe/Berlin"
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
            2019, 1, 1, 11, 00, tzinfo=timezone.utc
        )

    def test_next_run_interval(self):
        ts = datetime(2019, 1, 1, 1, 10, 20, tzinfo=timezone.utc)
        monitor = Monitor(
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment(monitor=monitor, last_checkin=ts)

        # XXX: Seconds are removed as we clamp to the minute.
        assert monitor_environment.monitor.get_next_scheduled_checkin_with_margin(ts) == datetime(
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
    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_default_params_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert monitor_environment.mark_failed()

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
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

    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_reason_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert monitor_environment.mark_failed(reason=MonitorFailure.DURATION)

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
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

    @with_feature({"organizations:issue-platform": False})
    @patch("sentry.coreapi.insert_data_to_database_legacy")
    def test_mark_failed_with_missed_reason_legacy(self, mock_insert_data_to_database_legacy):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        assert monitor_environment.mark_failed(reason=MonitorFailure.MISSED_CHECKIN)

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.MISSED_CHECKIN

        assert len(mock_insert_data_to_database_legacy.mock_calls) == 1

        event = mock_insert_data_to_database_legacy.mock_calls[0].args[0]

        assert dict(
            event,
            **{
                "level": "error",
                "project": self.project.id,
                "environment": monitor_environment.environment.name,
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

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_default_params_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )

        successful_check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )

        last_checkin = timezone.now()
        assert monitor_environment.mark_failed(last_checkin=last_checkin)

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "error"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": "An error occurred during the last check-in.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "error", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_check_in.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorCheckInFailure.type_id,
                "level": "error",
                "culprit": "error",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
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
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "error"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        successful_check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            status=CheckInStatus.OK,
        )
        last_checkin = timezone.now()
        assert monitor_environment.mark_failed(
            last_checkin=last_checkin,
            reason=MonitorFailure.DURATION,
            occurrence_context={"duration": 30},
        )

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "duration"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": "Check-in exceeded maximum duration of 30 minutes.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "duration", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": successful_check_in.date_added.isoformat(),
                        "important": False,
                    },
                ],
                "type": MonitorCheckInTimeout.type_id,
                "level": "error",
                "culprit": "duration",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
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
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "duration"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
            },
        ) == dict(event)

    @with_feature("organizations:issue-platform")
    @patch("sentry.issues.producer.produce_occurrence_to_kafka")
    def test_mark_failed_with_missed_reason_issue_platform(self, mock_produce_occurrence_to_kafka):
        monitor = Monitor.objects.create(
            name="test monitor",
            organization_id=self.organization.id,
            project_id=self.project.id,
            type=MonitorType.CRON_JOB,
            config={"schedule": [1, "month"], "schedule_type": ScheduleType.INTERVAL},
        )
        monitor_environment = MonitorEnvironment.objects.create(
            monitor=monitor,
            environment=self.environment,
            status=monitor.status,
        )
        last_checkin = timezone.now()
        datetime_format = "%Y-%m-%d %I:%M %p"
        expected_time = monitor.get_next_scheduled_checkin(last_checkin).strftime(datetime_format)

        assert monitor_environment.mark_failed(
            last_checkin=last_checkin,
            reason=MonitorFailure.MISSED_CHECKIN,
            occurrence_context={"expected_time": expected_time},
        )

        monitor.refresh_from_db()
        monitor_environment.refresh_from_db()
        assert monitor_environment.status == MonitorStatus.MISSED_CHECKIN

        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1

        occurrence, event = mock_produce_occurrence_to_kafka.mock_calls[0].args
        occurrence = occurrence.to_dict()

        assert dict(
            occurrence,
            **{
                "project_id": self.project.id,
                "fingerprint": [hash_from_values(["monitor", str(monitor.guid), "missed_checkin"])],
                "issue_title": f"Monitor failure: {monitor.name}",
                "subtitle": f"No check-in reported at {expected_time}.",
                "resource_id": None,
                "evidence_data": {},
                "evidence_display": [
                    {"name": "Failure reason", "value": "missed_checkin", "important": True},
                    {
                        "name": "Environment",
                        "value": monitor_environment.environment.name,
                        "important": False,
                    },
                    {
                        "name": "Last successful check-in",
                        "value": "None",
                        "important": False,
                    },
                ],
                "type": MonitorCheckInMissed.type_id,
                "level": "warning",
                "culprit": "missed_checkin",
            },
        ) == dict(occurrence)

        assert dict(
            event,
            **{
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
                "environment": monitor_environment.environment.name,
                "event_id": occurrence["event_id"],
                "fingerprint": ["monitor", str(monitor.guid), "missed_checkin"],
                "platform": "other",
                "project_id": monitor.project_id,
                "sdk": None,
                "tags": {
                    "monitor.id": str(monitor.guid),
                    "monitor.slug": monitor.slug,
                },
            },
        ) == dict(event)

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
