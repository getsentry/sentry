from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.test import RequestFactory
from django.test.utils import override_settings

from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.models import Monitor, MonitorLimitsExceeded, ScheduleType
from sentry.monitors.validators import (
    MonitorDataSourceValidator,
    MonitorIncidentDetectorValidator,
    MonitorValidator,
)
from sentry.testutils.cases import MonitorTestCase
from sentry.types.actor import Actor
from sentry.utils.outcomes import Outcome
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.workflow_engine.models import DataConditionGroup


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

    def test_partial_config_update_preserves_existing_fields(self):
        """Test that partial config updates preserve fields not included in the update."""
        # Set up a monitor with a complete config
        original_config = {
            "schedule": "0 * * * *",
            "schedule_type": ScheduleType.CRONTAB,
            "checkin_margin": 5,
            "max_runtime": 30,
            "timezone": "UTC",
            "failure_issue_threshold": 3,
            "recovery_threshold": 1,
        }
        self.monitor.update(config=original_config)

        # Update only the schedule - other fields should be preserved
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": {"schedule": "*/30 * * * *", "schedule_type": "crontab"}},
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
        assert updated_monitor.config["checkin_margin"] == 5
        assert updated_monitor.config["max_runtime"] == 30
        assert updated_monitor.config["timezone"] == "UTC"
        assert updated_monitor.config["failure_issue_threshold"] == 3
        assert updated_monitor.config["recovery_threshold"] == 1


class BaseMonitorValidatorTestCase(MonitorTestCase):
    """Base class for monitor validator tests with common setup."""

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.request = RequestFactory().get("/")
        self.request.user = self.user
        access = MagicMock()
        access.has_any_project_scope.return_value = True
        self.request.access = access
        self.context = {
            "request": self.request,
            "organization": self.organization,
            "project": self.project,
            "access": access,
        }

    def _get_base_config(self, schedule_type="crontab", **overrides):
        """Get base monitor config with optional overrides."""
        config = {
            "schedule": "0 * * * *",
            "scheduleType": schedule_type,
            "checkinMargin": 5,
            "maxRuntime": 30,
            "timezone": "UTC",
        }
        if schedule_type == "interval":
            config["schedule"] = [1, "hour"]
        config.update(overrides)
        return config


class MonitorDataSourceValidatorTest(BaseMonitorValidatorTestCase):
    def setUp(self):
        super().setUp()
        self.valid_data = self._get_valid_data()

    def _get_valid_data(self, **overrides):
        data = {
            "name": "Test Monitor",
            "slug": "test-monitor",
            "config": self._get_base_config(),
        }
        data.update(overrides)
        return data

    def _create_validator(self, data=None, instance=None, partial=False):
        return MonitorDataSourceValidator(
            data=data or self.valid_data,
            instance=instance,
            partial=partial,
            context=self.context,
        )

    def _assert_valid_monitor_data(
        self, validator, expected_name, expected_slug, expected_schedule, expected_type
    ):
        """Helper to assert common monitor validation results."""
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["name"] == expected_name
        assert validated_data["slug"] == expected_slug
        assert validated_data["config"]["schedule"] == expected_schedule
        assert validated_data["config"]["schedule_type"] == expected_type

    def test_valid_crontab_config(self):
        validator = self._create_validator()
        self._assert_valid_monitor_data(
            validator, "Test Monitor", "test-monitor", "0 * * * *", ScheduleType.CRONTAB
        )

    def test_valid_interval_config(self):
        data = self._get_valid_data(
            name="Interval Monitor",
            slug="interval-monitor",
            config=self._get_base_config("interval", checkinMargin=10, maxRuntime=60),
        )
        validator = self._create_validator(data)
        self._assert_valid_monitor_data(
            validator, "Interval Monitor", "interval-monitor", [1, "hour"], ScheduleType.INTERVAL
        )

    def test_only_slug_provided(self):
        data = {
            "slug": "my-monitor-slug",
            "config": self.valid_data["config"],
        }
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["name"] == "my-monitor-slug"
        assert validated_data["slug"] == "my-monitor-slug"

    def test_only_name_provided(self):
        data = {
            "name": "My Monitor Name",
            "config": self.valid_data["config"],
        }
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["name"] == "My Monitor Name"
        assert validated_data["slug"] == "my-monitor-name"

    def test_missing_name_and_slug(self):
        data = {"config": self.valid_data["config"]}
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "Either name or slug must be provided" in str(validator.errors)

    def test_invalid_crontab_schedule(self):
        data = self._get_valid_data()
        data["config"]["schedule"] = "invalid cron"
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "schedule" in validator.errors["config"]

    def test_invalid_interval_schedule(self):
        data = self._get_valid_data(config=self._get_base_config("interval", schedule=[0, "hour"]))
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "schedule" in validator.errors["config"]

    def test_nonstandard_crontab_schedules(self):
        data = self._get_valid_data()
        data["config"]["schedule"] = "@hourly"
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        assert validator.validated_data["config"]["schedule"] == "0 * * * *"

    def _assert_monitor_attributes(self, monitor, name, slug, schedule, status=ObjectStatus.ACTIVE):
        """Helper to assert monitor attributes after creation."""
        assert isinstance(monitor, Monitor)
        assert monitor.name == name
        assert monitor.slug == slug
        assert monitor.organization_id == self.organization.id
        assert monitor.project_id == self.project.id
        assert monitor.config["schedule"] == schedule
        assert monitor.status == status
        assert monitor.is_muted is False
        assert monitor.owner_user_id is None
        assert monitor.owner_team_id is None

    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_create_source_creates_monitor(self, mock_assign_seat):
        mock_assign_seat.return_value = Outcome.ACCEPTED
        validator = self._create_validator()
        assert validator.is_valid(), validator.errors
        monitor = validator.validated_create_source(validator.validated_data)
        self._assert_monitor_attributes(monitor, "Test Monitor", "test-monitor", "0 * * * *")

    def test_validate_with_owner(self):
        team = self.create_team(organization=self.organization)
        data = self._get_valid_data(owner=f"team:{team.id}")
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert isinstance(validated_data["owner"], Actor)
        assert validated_data["owner"].is_team
        assert validated_data["owner"].id == team.id

    def test_validate_with_status(self):
        data = self._get_valid_data(status="disabled")
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["status"] == ObjectStatus.DISABLED

    def test_validate_with_is_muted(self):
        data = self._get_valid_data(isMuted=True)
        validator = self._create_validator(data)
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["is_muted"] is True

    def test_slug_uniqueness_validation(self):
        Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Existing Monitor",
            slug="test-monitor",
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
            },
        )
        validator = self._create_validator()
        assert not validator.is_valid()
        assert "slug" in validator.errors
        assert 'The slug "test-monitor" is already in use.' in str(validator.errors["slug"])

    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_quota_rejection_disables_monitor(self, mock_assign_seat):
        mock_assign_seat.return_value = Outcome.RATE_LIMITED
        validator = self._create_validator()
        assert validator.is_valid(), validator.errors
        monitor = validator.validated_create_source(validator.validated_data)
        assert monitor.status == ObjectStatus.DISABLED

    def test_update_monitor(self):
        monitor = Monitor.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            name="Original Monitor",
            slug="original-monitor",
            config={
                "schedule": "0 * * * *",
                "schedule_type": ScheduleType.CRONTAB,
                "checkin_margin": 5,
                "max_runtime": 30,
            },
        )
        update_data = {
            "name": "Updated Monitor",
            "config": {
                "schedule": "0 * * * *",
                "schedule_type": "crontab",
                "checkin_margin": 10,
                "max_runtime": 30,
            },
        }
        validator = self._create_validator(update_data, instance=monitor, partial=True)
        assert validator.is_valid(), validator.errors
        updated_monitor = validator.update(monitor, validator.validated_data)
        updated_monitor.refresh_from_db()
        assert updated_monitor.name == "Updated Monitor"
        assert updated_monitor.slug == "original-monitor"
        assert updated_monitor.config["checkin_margin"] == 10
        assert updated_monitor.config["max_runtime"] == 30
        assert updated_monitor.config["schedule"] == "0 * * * *"
        assert updated_monitor.config["schedule_type"] == ScheduleType.CRONTAB


class MonitorIncidentDetectorValidatorTest(BaseMonitorValidatorTestCase):
    def setUp(self):
        super().setUp()
        self.valid_data = self._get_valid_detector_data()

    def _get_valid_detector_data(self, **overrides):
        data = {
            "type": "monitor_check_in_failure",
            "name": "Test Monitor Detector",
            "dataSource": {
                "name": "Test Monitor",
                "slug": "test-monitor",
                "config": self._get_base_config(),
            },
        }
        data.update(overrides)
        return data

    def _create_validator(self, data=None, instance=None, partial=False):
        return MonitorIncidentDetectorValidator(
            data=data or self.valid_data,
            instance=instance,
            partial=partial,
            context=self.context,
        )

    def test_valid_detector_with_monitor(self):
        validator = self._create_validator()
        assert validator.is_valid(), validator.errors
        validated_data = validator.validated_data
        assert validated_data["name"] == "Test Monitor Detector"
        assert "data_source" in validated_data
        assert validated_data["data_source"]["name"] == "Test Monitor"
        assert validated_data["data_source"]["slug"] == "test-monitor"

    def test_detector_requires_data_source(self):
        data = {
            "type": "monitor_check_in_failure",
            "name": "Test Monitor Detector",
        }
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "dataSource" in validator.errors

    def test_create_detector_validates_data_source(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        context = {**self.context, "condition_group": condition_group}
        validator = MonitorIncidentDetectorValidator(
            data=self.valid_data,
            context=context,
        )
        assert validator.is_valid(), validator.errors
        assert "_creator" in validator.validated_data["data_source"]
        assert validator.validated_data["data_source"]["data_source_type"] == "cron_monitor"
