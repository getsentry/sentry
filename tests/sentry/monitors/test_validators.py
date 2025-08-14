from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.test import RequestFactory
from django.test.utils import override_settings

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.models import Monitor, MonitorLimitsExceeded, ScheduleType
from sentry.monitors.validators import MonitorValidator
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import MonitorTestCase
from sentry.utils.outcomes import Outcome


class MonitorValidatorCreateTest(MonitorTestCase):
    def setUp(self):
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


class MonitorValidatorUpdateTest(MonitorTestCase):
    def setUp(self):
        super().setUp()
        self.login_as(self.user)

        self.monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Test Monitor",
            slug="test-monitor",
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
                "max_runtime": 30,
            },
        )
        self.team = self.create_team(organization=self.organization)
        self.request = RequestFactory().get("/")
        self.request.user = self.user

        # Create a mock access object
        self.access = MagicMock()
        self.access.has_project_scope.return_value = True

    def test_update_name(self):
        """Test updating monitor name."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"name": "Updated Monitor Name"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.name == "Updated Monitor Name"
        assert updated_monitor.slug == "test-monitor"  # Slug unchanged

    def test_update_slug(self):
        """Test updating monitor slug."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"slug": "new-monitor-slug"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.slug == "new-monitor-slug"
        assert updated_monitor.name == "Test Monitor"  # Name unchanged

    def test_update_config(self):
        """Test updating monitor config."""
        new_config = {
            "schedule": "*/30 * * * *",
            "schedule_type": "crontab",
            "checkin_margin": 10,
            "max_runtime": 60,
            "timezone": "America/New_York",
        }
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": new_config},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.config["schedule"] == "*/30 * * * *"
        assert updated_monitor.config["checkin_margin"] == 10
        assert updated_monitor.config["max_runtime"] == 60
        assert updated_monitor.config["timezone"] == "America/New_York"

    def test_update_owner_to_user(self):
        """Test updating monitor owner to a user."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"owner": f"user:{self.user.id}"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid(), validator.errors

        updated_monitor = validator.save()
        assert updated_monitor.owner_user_id == self.user.id
        assert updated_monitor.owner_team_id is None

    def test_update_owner_to_team(self):
        """Test updating monitor owner to a team."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"owner": f"team:{self.team.id}"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.owner_user_id is None
        assert updated_monitor.owner_team_id == self.team.id

    def test_update_owner_to_none(self):
        """Test removing monitor owner."""
        # First set an owner
        self.monitor.update(owner_user_id=self.user.id)

        validator = MonitorValidator(
            instance=self.monitor,
            data={"owner": None},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.owner_user_id is None
        assert updated_monitor.owner_team_id is None

    def test_update_is_muted(self):
        """Test updating is_muted field."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"is_muted": True},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.is_muted is True

    def test_update_status_to_disabled(self):
        """Test updating monitor status to disabled."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={"status": "disabled"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
                "monitor": self.monitor,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.status == ObjectStatus.DISABLED

    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    def test_update_status_to_active_with_quota_check(self, mock_check_seat):
        """Test updating monitor status to active checks quota."""
        # Start with disabled monitor
        self.monitor.update(status=ObjectStatus.DISABLED)

        mock_result = MagicMock()
        mock_result.assignable = True
        mock_check_seat.return_value = mock_result

        validator = MonitorValidator(
            instance=self.monitor,
            data={"status": "active"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
                "monitor": self.monitor,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.status == ObjectStatus.ACTIVE
        mock_check_seat.assert_called_once_with(self.monitor)

    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    def test_update_status_to_active_quota_exceeded(self, mock_check_seat):
        """Test updating monitor status to active fails when quota exceeded."""
        # Start with disabled monitor
        self.monitor.update(status=ObjectStatus.DISABLED)

        mock_result = MagicMock()
        mock_result.assignable = False
        mock_result.reason = "Monitor quota exceeded"
        mock_check_seat.return_value = mock_result

        validator = MonitorValidator(
            instance=self.monitor,
            data={"status": "active"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
                "monitor": self.monitor,
            },
        )
        assert not validator.is_valid()
        assert "Monitor quota exceeded" in str(validator.errors["status"])

    def test_update_multiple_fields(self):
        """Test updating multiple fields at once."""
        validator = MonitorValidator(
            instance=self.monitor,
            data={
                "name": "New Name",
                "slug": "new-slug",
                "is_muted": True,
                "owner": f"team:{self.team.id}",
            },
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.name == "New Name"
        assert updated_monitor.slug == "new-slug"
        assert updated_monitor.is_muted is True
        assert updated_monitor.owner_team_id == self.team.id

    def test_update_slug_already_exists(self):
        """Test updating slug to one that already exists fails."""
        # Create another monitor with target slug
        Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Another Monitor",
            slug="existing-slug",
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
            },
        )

        validator = MonitorValidator(
            instance=self.monitor,
            data={"slug": "existing-slug"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert not validator.is_valid()
        assert 'The slug "existing-slug" is already in use.' in str(validator.errors["slug"])

    def test_update_preserves_unchanged_fields(self):
        """Test that update preserves fields that aren't being updated."""
        original_config = self.monitor.config.copy()

        validator = MonitorValidator(
            instance=self.monitor,
            data={"name": "Just Update Name"},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.name == "Just Update Name"
        assert updated_monitor.slug == "test-monitor"
        assert updated_monitor.config == original_config
