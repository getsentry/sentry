from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID

import pytest

from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.monitors.constants import TIMEOUT
from sentry.monitors.logic.mark_ok import mark_ok
from sentry.monitors.models import (
    CheckInStatus,
    Monitor,
    MonitorCheckIn,
    MonitorEnvBrokenDetection,
    MonitorEnvironment,
    MonitorIncident,
    ScheduleType,
)
from sentry.monitors.utils import get_timeout_at
from sentry.quotas.base import SeatAssignmentResult
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.outcomes import Outcome


class BaseMonitorDetailsTest(MonitorTestCase):
    __test__ = False

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["slug"] == monitor.slug

    def test_simple_with_id(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["slug"] == monitor.slug

        resp = self.get_success_response(self.organization.slug, monitor.guid)
        assert resp.data["slug"] == monitor.slug

        self.get_error_response(self.organization.slug, "asdf", status_code=404)

        uuid = UUID("00000000-0000-0000-0000-000000000000")
        self.get_error_response(self.organization.slug, uuid, status_code=404)

    def test_simple_with_uuid_like_slug(self):
        """
        When the slug looks like a UUID we still want to make sure we're
        prioritizing slug lookup
        """
        monitor = self._create_monitor(slug="8a65d0f2-b7d9-4b4a-9436-3de9db3c9e2f")

        # We can still find our monitor by it's slug
        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["slug"] == monitor.slug

        # We can still find our monitor by it's id
        resp = self.get_success_response(self.organization.slug, monitor.guid)
        assert resp.data["slug"] == monitor.slug

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        self.get_error_response("asdf", monitor.slug, status_code=404)

    def test_monitor_environment(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(monitor)

        self.get_success_response(self.organization.slug, monitor.slug, environment="production")
        self.get_error_response(
            self.organization.slug, monitor.slug, environment="jungle", status_code=404
        )

    def test_filtering_monitor_environment(self):
        monitor = self._create_monitor()
        prod_env = "production"
        prod = self._create_monitor_environment(monitor, name=prod_env)
        jungle_env = "jungle"
        jungle = self._create_monitor_environment(monitor, name=jungle_env)

        response = self.get_success_response(self.organization.slug, monitor.slug)
        result_envs = response.data["environments"]
        result_envs.sort(key=lambda env: env["name"])
        assert result_envs == [
            {
                "name": jungle_env,
                "status": jungle.get_status_display(),
                "isMuted": jungle.is_muted,
                "dateCreated": jungle.monitor.date_added,
                "lastCheckIn": jungle.last_checkin,
                "nextCheckIn": jungle.next_checkin,
                "nextCheckInLatest": jungle.next_checkin_latest,
                "activeIncident": None,
            },
            {
                "name": prod_env,
                "status": prod.get_status_display(),
                "isMuted": prod.is_muted,
                "dateCreated": prod.monitor.date_added,
                "lastCheckIn": prod.last_checkin,
                "nextCheckIn": prod.next_checkin,
                "nextCheckInLatest": prod.next_checkin_latest,
                "activeIncident": None,
            },
        ]

        response = self.get_success_response(
            self.organization.slug, monitor.slug, environment="production"
        )
        assert response.data["environments"] == [
            {
                "name": prod_env,
                "status": prod.get_status_display(),
                "isMuted": prod.is_muted,
                "dateCreated": prod.monitor.date_added,
                "lastCheckIn": prod.last_checkin,
                "nextCheckIn": prod.next_checkin,
                "nextCheckInLatest": prod.next_checkin_latest,
                "activeIncident": None,
            }
        ]

    def test_expand_issue_alert_rule(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.slug, expand=["alertRule"])
        assert resp.data["alertRule"] is None

        self._create_issue_alert_rule(monitor)
        resp = self.get_success_response(self.organization.slug, monitor.slug, expand=["alertRule"])
        issue_alert_rule = resp.data["alertRule"]
        assert issue_alert_rule is not None
        assert issue_alert_rule["environment"] is not None

    def test_with_active_incident_and_detection(self):
        monitor = self._create_monitor()
        monitor_env = self._create_monitor_environment(monitor)

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["environments"][0]["activeIncident"] is None

        starting_timestamp = datetime(2023, 12, 15, tzinfo=timezone.utc)
        monitor_incident = MonitorIncident.objects.create(
            monitor=monitor, monitor_environment=monitor_env, starting_timestamp=starting_timestamp
        )
        detection_timestamp = datetime(2024, 1, 1, tzinfo=timezone.utc)
        MonitorEnvBrokenDetection.objects.create(
            monitor_incident=monitor_incident, user_notified_timestamp=detection_timestamp
        )

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["environments"][0]["activeIncident"] == {
            "startingTimestamp": monitor_incident.starting_timestamp,
            "resolvingTimestamp": monitor_incident.resolving_timestamp,
            "brokenNotice": {
                "userNotifiedTimestamp": detection_timestamp,
                "environmentMutedTimestamp": None,
            },
        }

    def test_with_active_incident_no_detection(self):
        monitor = self._create_monitor()
        monitor_env = self._create_monitor_environment(monitor)

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["environments"][0]["activeIncident"] is None

        starting_timestamp = datetime(2023, 12, 15, tzinfo=timezone.utc)
        monitor_incident = MonitorIncident.objects.create(
            monitor=monitor, monitor_environment=monitor_env, starting_timestamp=starting_timestamp
        )

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["environments"][0]["activeIncident"] == {
            "startingTimestamp": monitor_incident.starting_timestamp,
            "resolvingTimestamp": monitor_incident.resolving_timestamp,
            "brokenNotice": None,
        }

    def test_owner_user(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(self.organization.slug, monitor.slug)

        assert resp.data["owner"] == {
            "type": "user",
            "id": str(self.user.id),
            "email": self.user.email,
            "name": self.user.email,
        }

    def test_owner_team(self):
        monitor = self._create_monitor(
            owner_user_id=None,
            owner_team_id=self.team.id,
        )
        resp = self.get_success_response(self.organization.slug, monitor.slug)

        assert resp.data["owner"] == {
            "type": "team",
            "id": str(self.team.id),
            "name": self.team.slug,
        }


@freeze_time()
class BaseUpdateMonitorTest(MonitorTestCase):
    __test__ = False

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_name(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"name": "Monitor Name"}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.name == "Monitor Name"

    def test_slug(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"slug": "my-monitor"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.slug == "my-monitor"

        # Validate error cases just to be safe
        self.get_error_response(
            self.organization.slug, monitor.slug, method="PUT", status_code=400, **{"slug": ""}
        )
        self.get_error_response(
            self.organization.slug, monitor.slug, method="PUT", status_code=400, **{"slug": None}
        )

    def test_owner(self):
        monitor = self._create_monitor()
        assert monitor.owner_user_id == self.user.id
        assert monitor.owner_team_id is None

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"owner": f"team:{self.team.id}"}
        )
        assert resp.data["id"] == str(monitor.guid)
        assert resp.data["owner"]["name"] == self.team.name

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.owner_team_id == self.team.id
        assert monitor.owner_user_id is None

        # Clear owner
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"owner": None}
        )
        assert resp.data["owner"] is None

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.owner_user_id is None
        assert monitor.owner_team_id is None

        # Validate error cases
        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"owner": "invalid"},
        )
        assert (
            resp.data["owner"][0]
            == "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
        )

        new_user = self.create_user()
        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"owner": f"user:{new_user.id}"},
        )
        assert resp.data["owner"][0] == "User is not a member of this organization"

    def test_invalid_numeric_slug(self):
        monitor = self._create_monitor()
        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"slug": "1234"},
        )
        assert resp.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_slug_exists(self):
        self._create_monitor(slug="my-test-monitor")
        other_monitor = self._create_monitor(slug="another-monitor")

        resp = self.get_error_response(
            self.organization.slug,
            other_monitor.slug,
            method="PUT",
            status_code=400,
            **{"slug": "my-test-monitor"},
        )

        assert resp.data["slug"][0] == 'The slug "my-test-monitor" is already in use.', resp.content

    def test_slug_same(self):
        monitor = self._create_monitor(slug="my-test-monitor")

        self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"slug": "my-test-monitor"}
        )

    def test_can_mute(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"isMuted": True}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.is_muted

    def test_can_unmute(self):
        monitor = self._create_monitor()

        monitor.update(is_muted=True)

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"isMuted": False}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert not monitor.is_muted

    def test_timezone(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"timezone": "America/Los_Angeles"}},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["timezone"] == "America/Los_Angeles"

    def test_checkin_margin(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor=monitor)

        check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=CheckInStatus.OK,
        )
        mark_ok(check_in, check_in.date_added)

        monitor_environment.refresh_from_db()
        assert (
            monitor_environment.next_checkin + timedelta(minutes=1)
            == monitor_environment.next_checkin_latest
        )

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"checkin_margin": -1}},
        )

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"checkin_margin": 30}},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["checkin_margin"] == 30

        # check that next_checkin_latest was updated appropriately
        monitor_environment.refresh_from_db()
        assert (
            monitor_environment.next_checkin + timedelta(minutes=30)
            == monitor_environment.next_checkin_latest
        )

        # check that unsetting the parameter works
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"checkin_margin": None}},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["checkin_margin"] is None

        monitor_environment.refresh_from_db()
        assert (
            monitor_environment.next_checkin + timedelta(minutes=1)
            == monitor_environment.next_checkin_latest
        )

    def test_max_runtime(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor=monitor)

        status = getattr(CheckInStatus, "IN_PROGRESS")

        check_in = MonitorCheckIn.objects.create(
            monitor=monitor,
            monitor_environment=monitor_environment,
            project_id=self.project.id,
            date_added=monitor.date_added,
            status=status,
            timeout_at=get_timeout_at(monitor.get_validated_config(), status, monitor.date_added),
        )

        assert check_in.timeout_at == check_in.date_added.replace(
            second=0, microsecond=0
        ) + timedelta(minutes=TIMEOUT)

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"max_runtime": -1}},
        )

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"config": {"max_runtime": 15}}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["max_runtime"] == 15

        # check that check-in timeout was updated properly
        check_in.refresh_from_db()
        assert check_in.timeout_at == check_in.date_added.replace(
            second=0, microsecond=0
        ) + timedelta(minutes=15)

        # check that unsetting the parameter works
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"config": {"max_runtime": None}}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["max_runtime"] is None

        check_in.refresh_from_db()
        assert check_in.timeout_at == check_in.date_added.replace(
            second=0, microsecond=0
        ) + timedelta(minutes=TIMEOUT)

    def test_existing_issue_alert_rule(self):
        monitor = self._create_monitor()
        rule = self._create_issue_alert_rule(monitor)
        new_environment = self.create_environment(name="jungle")
        new_user = self.create_user()
        self.create_team_membership(user=new_user, team=self.team)

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{
                "name": "new-name",
                "slug": "new-slug",
                "alert_rule": {
                    "targets": [{"targetIdentifier": new_user.id, "targetType": "Member"}],
                    "environment": new_environment.name,
                },
            },
        )
        assert resp.data["slug"] == "new-slug"

        monitor = Monitor.objects.get(id=monitor.id)
        monitor_rule = monitor.get_issue_alert_rule()
        assert monitor_rule.id == rule.id
        assert monitor_rule.label == "Monitor Alert: new-name"

        monitor_rule_actions = monitor_rule.data["actions"].copy()
        assert len(monitor_rule_actions) == 1
        monitor_rule_actions[0].pop("uuid")

        assert monitor_rule_actions == [
            {
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": new_user.id,
                "targetType": "Member",
            }
        ]
        # Verify the conditions haven't changed
        assert monitor_rule.data["conditions"] == [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": "new-slug",
            },
        ]
        rule_environment = Environment.objects.get(id=monitor_rule.environment_id)
        assert rule_environment.name == new_environment.name

    def test_existing_issue_alert_rule_add_slug_condition(self):
        monitor = self._create_monitor()
        rule = self._create_issue_alert_rule(monitor, exclude_slug_filter=True)
        new_environment = self.create_environment(name="jungle")
        new_user = self.create_user()
        self.create_team_membership(user=new_user, team=self.team)

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{
                "name": "new-name",
                "slug": "new-slug",
                "alert_rule": {
                    "targets": [{"targetIdentifier": new_user.id, "targetType": "Member"}],
                    "environment": new_environment.name,
                },
            },
        )
        assert resp.data["slug"] == "new-slug"
        monitor = Monitor.objects.get(id=monitor.id)
        monitor_rule = monitor.get_issue_alert_rule()
        assert monitor_rule.id == rule.id

        # Verify we added the slug filter
        assert monitor_rule.data["conditions"] == [
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": "new-slug",
            },
        ]

    def test_without_existing_issue_alert_rule(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{
                "alert_rule": {
                    "targets": [{"targetIdentifier": self.user.id, "targetType": "Member"}]
                }
            },
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        rule = monitor.get_issue_alert_rule()
        assert rule is not None

    def test_invalid_config_param(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"config": {"invalid": True}}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert "invalid" not in monitor.config

    def test_cronjob_crontab(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"schedule": "*/5 * * * *"}},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
        assert monitor.config["schedule"] == "*/5 * * * *"

    # TODO(dcramer): would be lovely to run the full spectrum, but it requires
    # this test to not be class-based
    # @pytest.mark.parametrize('input,expected', (
    #     ['@yearly', '0 0 1 1 *'],
    #     ['@annually', '0 0 1 1 *'],
    #     ['@monthly', '0 0 1 * *'],
    #     ['@weekly', '0 0 * * 0'],
    #     ['@daily', '0 0 * * *'],
    #     ['@hourly', '0 * * * *'],
    # ))
    def test_cronjob_nonstandard(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"schedule": "@monthly"}},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
        assert monitor.config["schedule"] == "0 0 1 * *"

    def test_cronjob_crontab_invalid(self):
        monitor = self._create_monitor()

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "*/0.5 * * * *"}},
        )
        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "* * * *"}},
        )
        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "* * 31 9 *"}},
        )

    def test_crontab_unsupported(self):
        monitor = self._create_monitor()

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "0 0 0 * * *"}},
        )
        assert (
            resp.data["config"]["schedule"][0] == "Only 5 field crontab syntax is supported"
        ), resp.content

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            # Using a \u3000 ideographic space
            **{"config": {"schedule": "0 0 0 * *　*"}},
        )
        assert (
            resp.data["config"]["schedule"][0] == "Only 5 field crontab syntax is supported"
        ), resp.content

    def test_cronjob_interval(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"config": {"schedule_type": "interval", "schedule": [1, "month"]}},
        )

        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.INTERVAL
        assert monitor.config["schedule"] == [1, "month"]

    def test_cronjob_interval_invalid_inteval(self):
        monitor = self._create_monitor()

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": [1, "decade"]}},
        )

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": ["foo", "month"]}},
        )

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": [-1, "day"]}},
        )

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": "bar"}},
        )

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()

        self.get_error_response(
            "asdf",
            monitor.slug,
            method="PUT",
            status_code=404,
            **{"config": {"schedule_type": "interval", "schedule": [1, "month"]}},
        )

    def test_cannot_change_project(self):
        monitor = self._create_monitor()

        project2 = self.create_project()
        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"project": project2.slug},
        )

        assert (
            resp.data["detail"]["message"] == "existing monitors may not be moved between projects"
        ), resp.content

    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_activate_monitor_success(self, assign_monitor_seat, check_assign_monitor_seat):
        check_assign_monitor_seat.return_value = SeatAssignmentResult(assignable=True)
        assign_monitor_seat.return_value = Outcome.ACCEPTED

        monitor = self._create_monitor()
        monitor.update(status=ObjectStatus.DISABLED)

        self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "active"}
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE
        assert assign_monitor_seat.called

    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_no_activate_if_already_activated(self, assign_monitor_seat, check_assign_monitor_seat):
        check_assign_monitor_seat.return_value = SeatAssignmentResult(assignable=True)
        assign_monitor_seat.return_value = Outcome.ACCEPTED

        monitor = self._create_monitor()

        self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "active"}
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE
        assert not assign_monitor_seat.called

    @patch("sentry.quotas.backend.disable_monitor_seat")
    def test_no_disable_if_already_disabled(self, disable_monitor_seat):
        monitor = self._create_monitor()

        self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "active"}
        )
        monitor.update(status=ObjectStatus.DISABLED)
        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.DISABLED
        assert not disable_monitor_seat.called

    @patch("sentry.quotas.backend.update_monitor_slug")
    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_update_slug_sends_right_slug_to_assign(
        self, assign_monitor_seat, check_assign_monitor_seat, update_monitor_slug
    ):
        check_assign_monitor_seat.return_value = SeatAssignmentResult(assignable=True)

        def dummy_assign(monitor):
            assert monitor.slug == old_slug
            return Outcome.ACCEPTED

        assign_monitor_seat.side_effect = dummy_assign

        monitor = self._create_monitor()
        monitor.update(status=ObjectStatus.DISABLED)
        old_slug = monitor.slug
        new_slug = "new_slug"
        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{"status": "active", "slug": new_slug},
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE
        update_call_args = update_monitor_slug.call_args
        assert update_call_args[0] == (old_slug, new_slug, monitor.project_id)

    @patch("sentry.quotas.backend.check_assign_monitor_seat")
    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_activate_monitor_invalid(self, assign_monitor_seat, check_assign_monitor_seat):
        result = SeatAssignmentResult(
            assignable=False,
            reason="Over quota",
        )
        check_assign_monitor_seat.return_value = result

        monitor = self._create_monitor()
        monitor.update(status=ObjectStatus.DISABLED)

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"status": "active"},
        )

        assert resp.data["status"][0] == result.reason
        assert not assign_monitor_seat.called

    @patch("sentry.quotas.backend.disable_monitor_seat")
    def test_deactivate_monitor(self, disable_monitor_seat):
        monitor = self._create_monitor()

        self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "disabled"}
        )

        assert disable_monitor_seat.called


class BaseDeleteMonitorTest(MonitorTestCase):
    __test__ = False

    def setUp(self):
        self.login_as(user=self.user)
        super().setUp()

    @patch("sentry.quotas.backend.disable_monitor_seat")
    @patch("sentry.quotas.backend.update_monitor_slug")
    def test_simple(self, mock_update_monitor_slug, mock_disable_monitor_seat):
        monitor = self._create_monitor()
        old_slug = monitor.slug

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.PENDING_DELETION
        # Slug should update on deletion
        assert monitor.slug != old_slug
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor.id, model_name="Monitor"
        ).exists()
        mock_update_monitor_slug.assert_called_once()
        mock_disable_monitor_seat.assert_called_once_with(monitor=monitor)

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        self.get_error_response("asdf", monitor.slug, status_code=404)

    def test_environment(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(monitor)

        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="DELETE",
            status_code=202,
            qs_params={"environment": "production"},
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment.id, model_name="MonitorEnvironment"
        ).exists()

    def test_multiple_environments(self):
        monitor = self._create_monitor()
        monitor_environment_a = self._create_monitor_environment(monitor, name="alpha")
        monitor_environment_b = self._create_monitor_environment(monitor, name="beta")

        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="DELETE",
            status_code=202,
            qs_params={"environment": ["alpha", "beta"]},
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment_a = MonitorEnvironment.objects.get(id=monitor_environment_a.id)
        assert monitor_environment_a.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment_a.id, model_name="MonitorEnvironment"
        ).exists()

        monitor_environment_b = MonitorEnvironment.objects.get(id=monitor_environment_b.id)
        assert monitor_environment_b.status == ObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment_b.id, model_name="MonitorEnvironment"
        ).exists()

    def test_bad_environment(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(monitor)

        self.get_error_response(
            self.organization.slug,
            monitor.slug,
            status_code=404,
            qs_params={"environment": "jungle"},
        )

    def test_simple_with_issue_alert_rule(self):
        monitor = self._create_monitor()
        self._create_issue_alert_rule(monitor)

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        rule = Rule.objects.get(project_id=monitor.project_id, id=monitor.config["alert_rule_id"])
        assert rule.status == ObjectStatus.PENDING_DELETION
        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.DELETED.value).exists()

    def test_simple_with_issue_alert_rule_deleted(self):
        monitor = self._create_monitor()
        rule = self._create_issue_alert_rule(monitor)
        rule.delete()

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        with pytest.raises(Rule.DoesNotExist):
            Rule.objects.get(project_id=monitor.project_id, id=monitor.config["alert_rule_id"])
