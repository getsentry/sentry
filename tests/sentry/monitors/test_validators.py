from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.test import RequestFactory
from django.test.utils import override_settings

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.models import Monitor, MonitorLimitsExceeded, ScheduleType
from sentry.monitors.validators import MonitorValidator
from sentry.testutils.cases import MonitorTestCase
from sentry.utils.outcomes import Outcome
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE


class MonitorValidatorCreateTest(MonitorTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

        self.request = RequestFactory().get("/")
        self.request.user = self.user

        access = MagicMock()
        access.has_any_project_scope.return_value = True
        self.request.access = access
        self.context = {
            "organization": self.organization,
            "access": access,
            "request": self.request,
        }

    @patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "owner": f"user:{self.user.id}",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert monitor.organization_id == self.organization.id
        assert monitor.project_id == self.project.id
        assert monitor.name == "My Monitor"
        assert monitor.status == ObjectStatus.ACTIVE
        assert monitor.owner_user_id == self.user.id
        assert monitor.owner_team_id is None
        assert monitor.config == {
            "schedule_type": ScheduleType.CRONTAB,
            "schedule": "0 0 * * *",
            "checkin_margin": None,
            "max_runtime": None,
            "failure_issue_threshold": None,
            "recovery_threshold": None,
        }

        mock_record.assert_any_call(
            "cron_monitor.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            project_id=self.project.id,
            from_upsert=False,
        )
        mock_record.assert_called_with(
            "first_cron_monitor.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            project_id=self.project.id,
            from_upsert=False,
        )

    def test_slug(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "my-monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()
        assert monitor.slug == "my-monitor"

    def test_invalid_numeric_slug(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "slug" in validator.errors
        assert validator.errors["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self):
        data = {
            "project": self.project.slug,
            "name": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()
        assert monitor.slug.startswith("1234-")
        assert not monitor.slug.isdecimal()

    def test_crontab_whitespace(self):
        data = {
            "project": self.project.slug,
            "name": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "  *\t* *     * * "},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()
        assert monitor.config["schedule"] == "* * * * *"

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_organization_limit(self):
        for i in range(settings.MAX_MONITORS_PER_ORG):
            Monitor.objects.create(
                organization_id=self.organization.id,
                project_id=self.project.id,
                name=f"Unicron-{i}",
                slug=f"unicron-{i}",
                config={
                    "schedule_type": ScheduleType.CRONTAB,
                    "schedule": "0 0 * * *",
                },
            )

        data = {
            "project": self.project.slug,
            "name": f"Unicron-{settings.MAX_MONITORS_PER_ORG + 1}",
            "slug": f"unicron-{settings.MAX_MONITORS_PER_ORG + 1}",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        with pytest.raises(MonitorLimitsExceeded):
            validator.save()

    def test_simple_with_alert_rule(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
            "alert_rule": {
                "environment": self.environment.name,
                "targets": [{"targetIdentifier": self.user.id, "targetType": "Member"}],
            },
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        alert_rule_id = monitor.config["alert_rule_id"]
        rule = Rule.objects.get(
            project_id=monitor.project_id, id=alert_rule_id, source=RuleSource.CRON_MONITOR
        )
        assert rule is not None
        assert rule.environment_id == self.environment.id

    def test_checkin_margin_zero(self):
        # Invalid checkin margin
        #
        # XXX(epurkhiser): We currently transform 0 -> 1 for backwards
        # compatability. If we remove the custom transformer in the config
        # validator this test will change to a validation error test.
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "cron_job",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily", "checkin_margin": 0},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()
        assert monitor.config["checkin_margin"] == 1

    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_create_monitor_assigns_seat(self, assign_monitor_seat):
        assign_monitor_seat.return_value = Outcome.ACCEPTED

        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assign_monitor_seat.assert_called_with(monitor)
        assert monitor.status == ObjectStatus.ACTIVE

    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_create_monitor_without_seat(self, assign_monitor_seat):
        assign_monitor_seat.return_value = Outcome.RATE_LIMITED

        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert assign_monitor_seat.called
        monitor.refresh_from_db()
        assert monitor.status == ObjectStatus.DISABLED

    def test_invalid_schedule(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            # There is no February 31st
            "config": {"schedule_type": "crontab", "schedule": "0 0 31 2 *"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert not validator.is_valid()
        assert "config" in validator.errors
        assert "schedule" in validator.errors["config"]
        assert validator.errors["config"]["schedule"][0] == "Schedule is invalid"

    def test_create_with_owner_team(self):
        """Test creating a monitor with a team owner."""
        team = self.create_team(organization=self.organization)
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "owner": f"team:{team.id}",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert monitor.owner_user_id is None
        assert monitor.owner_team_id == team.id

    def test_create_with_status_disabled(self):
        """Test creating a monitor with disabled status."""
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "status": "disabled",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert monitor.status == ObjectStatus.DISABLED

    def test_create_with_is_muted(self):
        """Test creating a muted monitor."""
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "isMuted": True,  # Note: camelCase as per API convention
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert monitor.is_muted is True
