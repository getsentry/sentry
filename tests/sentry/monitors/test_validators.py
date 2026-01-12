from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from django.test import RequestFactory
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.exceptions import ErrorDetail

from sentry.analytics.events.cron_monitor_created import CronMonitorCreated, FirstCronMonitorCreated
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.models import (
    Monitor,
    MonitorStatus,
    ScheduleType,
    get_cron_monitor,
    is_monitor_muted,
)
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.monitors.utils import get_detector_for_monitor
from sentry.monitors.validators import (
    MonitorDataSourceValidator,
    MonitorIncidentDetectorValidator,
    MonitorValidator,
)
from sentry.quotas.base import SeatAssignmentResult
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.analytics import assert_any_analytics_event
from sentry.types.actor import Actor
from sentry.utils.outcomes import Outcome
from sentry.utils.slug import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.workflow_engine.models import DataConditionGroup, DataSource, DataSourceDetector


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

        assert_any_analytics_event(
            mock_record,
            CronMonitorCreated(
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                from_upsert=False,
            ),
        )
        assert_any_analytics_event(
            mock_record,
            FirstCronMonitorCreated(
                user_id=self.user.id,
                organization_id=self.organization.id,
                project_id=self.project.id,
                from_upsert=False,
            ),
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
        assert not validator.is_valid()

        assert validator.errors["nonFieldErrors"] == [
            ErrorDetail(
                f"You may not exceed {settings.MAX_MONITORS_PER_ORG} monitors per organization",
                code="invalid",
            )
        ]

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

    @patch("sentry.quotas.backend.assign_seat")
    def test_create_monitor_assigns_seat(self, assign_seat):
        assign_seat.return_value = Outcome.ACCEPTED

        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assign_seat.assert_called_with(seat_object=monitor)
        assert monitor.status == ObjectStatus.ACTIVE

    @patch("sentry.quotas.backend.assign_seat")
    def test_create_monitor_without_seat(self, assign_seat):
        assign_seat.return_value = Outcome.RATE_LIMITED

        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        assert assign_seat.called
        monitor.refresh_from_db()
        assert monitor.status == ObjectStatus.DISABLED

        # Verify the detector is also disabled when quota is exceeded
        detector = get_detector_for_monitor(monitor)
        assert detector is not None
        assert detector.enabled is False

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

    def test_create_with_is_muted_noop(self):
        """Test that creating a monitor with is_muted does nothing.

        Since is_muted is computed from MonitorEnvironment.is_muted, setting is_muted=True
        during monitor creation has no effect because there are no environments yet.
        A monitor with no environments is always considered unmuted.

        To mute a monitor, you must use the update API after the monitor has environments.
        """
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "isMuted": True,  # This has no effect on creation
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        validator = MonitorValidator(data=data, context=self.context)
        assert validator.is_valid()

        monitor = validator.save()

        # Monitor has no environments, so is_muted returns False regardless of input
        assert is_monitor_muted(monitor) is False


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

    def test_partial_config_update_different_field(self):
        """Test that updating a config field doesn't trigger false positive margin/runtime changes."""
        now = timezone.now().replace(second=0, microsecond=0)
        env = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=now,
            next_checkin=now + timedelta(hours=1),
            next_checkin_latest=now + timedelta(hours=1, minutes=5),
        )
        original_next_checkin_latest = env.next_checkin_latest

        # Update only timezone, NOT checkin_margin
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": {"timezone": "America/New_York"}},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.config["timezone"] == "America/New_York"
        assert updated_monitor.config["checkin_margin"] == 5

        # With buggy code, checking the partial
        # new_config.get("checkin_margin") would return None, when comparing
        # that with the existing checkin_margin we would consider it as having
        # "changed" and would have recomputed the next_checkin_latest

        # Verify that because checkin_margin was not changed we did not
        # recompute the next_checkin_latest
        env.refresh_from_db()
        assert env.next_checkin_latest == original_next_checkin_latest

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
        # Create an environment first so the monitor can be muted
        env = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            is_muted=False,
        )

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
        assert is_monitor_muted(updated_monitor) is True

        # Verify the environment was also muted
        env.refresh_from_db()
        assert env.is_muted is True

    def test_update_is_muted_propagates_to_environments(self):
        """Test that muting a monitor propagates to all its environments."""
        # Create two monitor environments
        env1 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            is_muted=False,
        )
        env2_env = self.create_environment(name="production", project=self.project)
        env2 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=env2_env.id,
            is_muted=False,
        )

        # Mute the monitor
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
        assert is_monitor_muted(updated_monitor) is True

        # Verify both environments are now muted
        env1.refresh_from_db()
        env2.refresh_from_db()
        assert env1.is_muted is True
        assert env2.is_muted is True

    def test_update_is_muted_false_propagates_to_environments(self):
        """Test that unmuting a monitor propagates to all its environments."""
        # Create two muted monitor environments
        env1 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            is_muted=True,
        )
        env2_env = self.create_environment(name="production", project=self.project)
        env2 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=env2_env.id,
            is_muted=True,
        )

        # Verify monitor is muted (all environments are muted)
        assert is_monitor_muted(self.monitor) is True

        # Unmute the monitor via validator
        validator = MonitorValidator(
            instance=self.monitor,
            data={"is_muted": False},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()
        updated_monitor = validator.save()
        assert is_monitor_muted(updated_monitor) is False

        # Verify both environments are now unmuted
        env1.refresh_from_db()
        env2.refresh_from_db()
        assert env1.is_muted is False
        assert env2.is_muted is False

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

    @patch("sentry.quotas.backend.check_assign_seat")
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
        mock_check_seat.assert_called_once_with(seat_object=self.monitor)

    @patch("sentry.quotas.backend.check_assign_seat")
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
        assert is_monitor_muted(updated_monitor) is False
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

    def test_update_schedule_recomputes_next_checkin(self):
        """Test that updating the schedule recomputes next_checkin for all environments."""
        # Create monitor environments with specific next_checkin times
        now = timezone.now().replace(second=0, microsecond=0)
        env1 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=now,
            next_checkin=now + timedelta(hours=1),  # Based on hourly schedule
            next_checkin_latest=now + timedelta(hours=1, minutes=5),
        )
        env2_env = self.create_environment(name="production", project=self.project)
        env2 = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=env2_env.id,
            status=MonitorStatus.OK,
            last_checkin=now,
            next_checkin=now + timedelta(hours=1),  # Based on hourly schedule
            next_checkin_latest=now + timedelta(hours=1, minutes=5),
        )

        # Update the schedule from hourly to daily
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": {"schedule": "0 0 * * *", "schedule_type": "crontab"}},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.config["schedule"] == "0 0 * * *"

        # Verify that next_checkin was recomputed for both environments
        env1.refresh_from_db()
        env2.refresh_from_db()

        # The next check-in should now be based on the daily schedule (next midnight)
        expected_next_checkin = updated_monitor.get_next_expected_checkin(now)
        expected_next_checkin_latest = updated_monitor.get_next_expected_checkin_latest(now)

        assert env1.next_checkin == expected_next_checkin
        assert env1.next_checkin_latest == expected_next_checkin_latest
        assert env2.next_checkin == expected_next_checkin
        assert env2.next_checkin_latest == expected_next_checkin_latest

    def test_partial_config_update_does_not_trigger_schedule_recompute(self):
        """Test that updating only checkin_margin doesn't trigger schedule recomputation."""
        # Create a monitor environment with specific next_checkin times
        now = timezone.now().replace(second=0, microsecond=0)
        env = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=now,
            next_checkin=now + timedelta(hours=1),
            next_checkin_latest=now + timedelta(hours=1, minutes=5),
        )

        # Store original next_checkin time
        original_next_checkin = env.next_checkin

        # Update only checkin_margin without including schedule fields
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": {"checkin_margin": 10}},  # Only updating margin, not schedule
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.config["checkin_margin"] == 10
        # Schedule should remain unchanged
        assert updated_monitor.config["schedule"] == "0 * * * *"
        assert updated_monitor.config["schedule_type"] == ScheduleType.CRONTAB

        # Verify that next_checkin was NOT recomputed (would have changed if schedule logic ran)
        env.refresh_from_db()
        assert env.next_checkin == original_next_checkin

    def test_update_schedule_type_recomputes_next_checkin(self):
        """Test that changing schedule_type from crontab to interval recomputes next_checkin."""
        # Create a monitor environment
        now = timezone.now().replace(second=0, microsecond=0)
        env = self.create_monitor_environment(
            monitor=self.monitor,
            environment_id=self.environment.id,
            status=MonitorStatus.OK,
            last_checkin=now,
            next_checkin=now + timedelta(hours=1),
            next_checkin_latest=now + timedelta(hours=1, minutes=5),
        )

        # Change from crontab to interval schedule
        validator = MonitorValidator(
            instance=self.monitor,
            data={"config": {"schedule": [10, "minute"], "schedule_type": "interval"}},
            partial=True,
            context={
                "organization": self.organization,
                "access": self.access,
                "request": self.request,
            },
        )
        assert validator.is_valid()

        updated_monitor = validator.save()
        assert updated_monitor.config["schedule_type"] == ScheduleType.INTERVAL
        assert updated_monitor.config["schedule"] == [10, "minute"]

        # Verify that next_checkin was recomputed
        env.refresh_from_db()

        expected_next_checkin = updated_monitor.get_next_expected_checkin(now)
        expected_next_checkin_latest = updated_monitor.get_next_expected_checkin_latest(now)

        assert env.next_checkin == expected_next_checkin
        assert env.next_checkin_latest == expected_next_checkin_latest


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
        assert is_monitor_muted(monitor) is False
        assert monitor.owner_user_id is None
        assert monitor.owner_team_id is None

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
            "dataSources": [
                {
                    "name": "Test Monitor",
                    "slug": "test-monitor",
                    "config": self._get_base_config(),
                }
            ],
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
        assert "data_sources" in validated_data
        assert validated_data["data_sources"][0]["name"] == "Test Monitor"
        assert validated_data["data_sources"][0]["slug"] == "test-monitor"

    @pytest.mark.skip("Not required yet, migrating to dataSources")
    def test_detector_requires_data_source(self):
        data = {
            "type": "monitor_check_in_failure",
            "name": "Test Monitor Detector",
        }
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "dataSources" in validator.errors

    def test_rejects_multiple_data_sources(self):
        """Test that multiple data sources are rejected for cron monitors."""
        data = self._get_valid_detector_data(
            dataSources=[
                {
                    "name": "Test Monitor 1",
                    "slug": "test-monitor-1",
                    "config": self._get_base_config(),
                },
                {
                    "name": "Test Monitor 2",
                    "slug": "test-monitor-2",
                    "config": self._get_base_config(),
                },
            ]
        )
        validator = self._create_validator(data)
        assert not validator.is_valid()
        assert "dataSources" in validator.errors
        assert "Only one data source is allowed" in str(validator.errors["dataSources"])

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
        assert "_creator" in validator.validated_data["data_sources"][0]
        assert validator.validated_data["data_sources"][0]["data_source_type"] == "cron_monitor"

    @patch("sentry.quotas.backend.assign_seat", return_value=Outcome.ACCEPTED)
    def test_create_enabled_assigns_seat(self, mock_assign_seat):
        """Test that creating an enabled detector assigns a billing seat."""

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
        detector = validator.save()

        detector.refresh_from_db()
        assert detector.enabled is True

        # Verify seat was assigned exactly once (not double-called)
        monitor = get_cron_monitor(detector)
        mock_assign_seat.assert_called_once_with(seat_object=monitor)

    @patch("sentry.quotas.backend.assign_seat", return_value=Outcome.RATE_LIMITED)
    def test_create_enabled_no_seat_available(self, mock_assign_seat):
        """
        Test that creating a detector with no seats available creates it but
        leaves it disabled.
        """
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
        detector = validator.save()

        detector.refresh_from_db()
        # Detector created but not enabled due to no seat assignment
        assert detector.enabled is False
        monitor = get_cron_monitor(detector)
        assert monitor.status == ObjectStatus.DISABLED

        # Verify seat assignment was attempted exactly once (not double-called)
        mock_assign_seat.assert_called_once_with(seat_object=monitor)

    @patch("sentry.quotas.backend.assign_seat", return_value=Outcome.ACCEPTED)
    def test_update_enable_assigns_seat(self, mock_assign_seat):
        """
        Test that enabling a previously disabled detector assigns a seat.
        """
        # Create a disabled detector
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="monitor_check_in_failure",
            enabled=False,
        )
        monitor = self._create_monitor(
            name="Test Monitor",
            slug="test-monitor",
            status=ObjectStatus.DISABLED,
        )
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.organization.id,
            source_id=str(monitor.id),
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        validator = MonitorIncidentDetectorValidator(
            instance=detector, data={"enabled": True}, context=self.context, partial=True
        )
        assert validator.is_valid(), validator.errors
        validator.save()

        detector.refresh_from_db()
        monitor.refresh_from_db()
        assert detector.enabled is True
        assert monitor.status == ObjectStatus.ACTIVE

        # Verify seat was assigned exactly once
        mock_assign_seat.assert_called_once_with(seat_object=monitor)

    @patch(
        "sentry.quotas.backend.check_assign_seat",
        return_value=SeatAssignmentResult(assignable=False, reason="No seats available"),
    )
    def test_update_enable_no_seat_available(self, mock_check_seat):
        """
        Test that enabling fails with validation error when no seats are
        available.
        """
        # Create a disabled detector
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="monitor_check_in_failure",
            enabled=False,
        )
        monitor = self._create_monitor(
            name="Test Monitor",
            slug="test-monitor",
            status=ObjectStatus.DISABLED,
        )
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.organization.id,
            source_id=str(monitor.id),
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        validator = MonitorIncidentDetectorValidator(
            instance=detector, data={"enabled": True}, context=self.context, partial=True
        )

        # Validation should fail due to no seats available
        assert not validator.is_valid()
        assert "enabled" in validator.errors
        assert validator.errors["enabled"] == ["No seats available"]

        # Detector and monitor should still be disabled
        detector.refresh_from_db()
        monitor.refresh_from_db()
        assert detector.enabled is False
        assert monitor.status == ObjectStatus.DISABLED

        # Verify seat availability check was performed
        mock_check_seat.assert_called_with(seat_object=monitor)

    @patch("sentry.quotas.backend.disable_seat")
    def test_update_disable_disables_seat(self, mock_disable_seat):
        """Test that disabling a previously enabled detector disables the seat."""
        # Create an enabled detector
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="monitor_check_in_failure",
            enabled=True,
        )
        monitor = self._create_monitor(
            name="Test Monitor",
            slug="test-monitor",
            status=ObjectStatus.ACTIVE,
        )
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.organization.id,
            source_id=str(monitor.id),
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        validator = MonitorIncidentDetectorValidator(
            instance=detector, data={"enabled": False}, context=self.context, partial=True
        )
        assert validator.is_valid(), validator.errors
        validator.save()

        detector.refresh_from_db()
        monitor.refresh_from_db()
        assert detector.enabled is False
        assert monitor.status == ObjectStatus.DISABLED

        # Verify disable_seat was called exactly once
        mock_disable_seat.assert_called_once_with(seat_object=monitor)

    @patch("sentry.quotas.backend.remove_seat")
    def test_delete_removes_seat(self, mock_remove_seat: MagicMock) -> None:
        """Test that deleting a detector removes its billing seat immediately."""
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="monitor_check_in_failure",
            enabled=True,
        )
        monitor = self._create_monitor(
            name="Test Monitor",
            slug="test-monitor",
            status=ObjectStatus.ACTIVE,
        )
        data_source = DataSource.objects.create(
            type=DATA_SOURCE_CRON_MONITOR,
            organization_id=self.organization.id,
            source_id=str(monitor.id),
        )
        DataSourceDetector.objects.create(data_source=data_source, detector=detector)

        validator = MonitorIncidentDetectorValidator(
            instance=detector, data={}, context=self.context
        )

        validator.delete()

        # Verify remove_seat was called exactly once
        mock_remove_seat.assert_called_once_with(seat_object=monitor)
