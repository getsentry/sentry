from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from django.conf import settings
from django.test.utils import override_settings
from rest_framework.exceptions import ErrorDetail

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule, RuleSource
from sentry.monitors.models import Monitor, MonitorStatus, MonitorType, ScheduleType
from sentry.quotas.base import SeatAssignmentResult
from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.outbox import outbox_runner
from sentry.utils.outcomes import Outcome


class ListOrganizationMonitorsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-index"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def check_valid_response(self, response, expected_monitors):
        assert [monitor.slug for monitor in expected_monitors] == [
            monitor_resp["slug"] for monitor_resp in response.data
        ]

    def check_valid_environments_response(self, response, monitor, expected_environments):
        assert [
            monitor_environment.get_environment().name
            for monitor_environment in expected_environments
        ] == [
            monitor_environment_resp["name"]
            for monitor_environment_resp in monitor.get("environments", [])
        ]

    def test_simple(self):
        monitor = self._create_monitor()
        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])

    def test_sort_status(self):
        last_checkin = datetime.now(UTC) - timedelta(minutes=1)
        last_checkin_older = datetime.now(UTC) - timedelta(minutes=5)

        def add_status_monitor(
            env_status_key: str,
            mon_status_key: str = "ACTIVE",
            date: datetime | None = None,
        ):
            env_status = getattr(MonitorStatus, env_status_key)
            mon_status = getattr(ObjectStatus, mon_status_key)

            monitor = self._create_monitor(
                status=mon_status,
                name=f"{mon_status_key}-{env_status_key}",
            )
            self._create_monitor_environment(
                monitor,
                name="jungle",
                last_checkin=(date or last_checkin) - timedelta(seconds=30),
                status=env_status,
            )
            self._create_monitor_environment(
                monitor,
                name="volcano",
                last_checkin=(date or last_checkin) - timedelta(seconds=15),
                status=MonitorStatus.DISABLED,
            )
            return monitor

        # Subsort next checkin time
        monitor_active = add_status_monitor("ACTIVE")
        monitor_ok = add_status_monitor("OK")
        monitor_disabled = add_status_monitor("OK", "DISABLED")
        monitor_error_older_checkin = add_status_monitor("ERROR", "ACTIVE", last_checkin_older)
        monitor_error = add_status_monitor("ERROR")

        monitor_muted = add_status_monitor("ACTIVE")
        monitor_muted.update(is_muted=True)

        response = self.get_success_response(
            self.organization.slug, params={"environment": "jungle"}
        )
        self.check_valid_response(
            response,
            [
                monitor_error,
                monitor_error_older_checkin,
                monitor_ok,
                monitor_active,
                monitor_muted,
                monitor_disabled,
            ],
        )

        response = self.get_success_response(
            self.organization.slug, asc="0", params={"environment": "jungle"}
        )
        self.check_valid_response(
            response,
            [
                monitor_disabled,
                monitor_muted,
                monitor_active,
                monitor_ok,
                monitor_error_older_checkin,
                monitor_error,
            ],
        )

    def test_sort_name(self):
        monitors = [
            self._create_monitor(name="Some Monitor"),
            self._create_monitor(name="A monitor"),
            self._create_monitor(name="ZA monitor"),
        ]
        monitors.sort(key=lambda m: m.name)

        response = self.get_success_response(self.organization.slug, sort="name")
        self.check_valid_response(response, monitors)

        monitors.reverse()
        response = self.get_success_response(self.organization.slug, sort="name", asc="0")
        self.check_valid_response(response, monitors)

    def test_sort_muted(self):
        monitors = [
            self._create_monitor(name="Z monitor", is_muted=True),
            self._create_monitor(name="Y monitor", is_muted=True),
            self._create_monitor(name="Some Monitor"),
            self._create_monitor(name="A monitor"),
            self._create_monitor(name="ZA monitor"),
        ]
        monitors.sort(key=lambda m: (m.is_muted, m.name))

        response = self.get_success_response(self.organization.slug, sort="muted")
        self.check_valid_response(response, monitors)

        monitors.reverse()
        response = self.get_success_response(self.organization.slug, sort="muted", asc="0")
        self.check_valid_response(response, monitors)

    def test_sort_muted_envs(self):
        muted_monitor_1 = self._create_monitor(name="Z monitor", is_muted=True)
        self._create_monitor_environment(muted_monitor_1, name="prod")
        muted_monitor_2 = self._create_monitor(name="Y monitor", is_muted=True)
        self._create_monitor_environment(muted_monitor_2, name="prod")
        non_muted_monitor_1 = self._create_monitor(name="Some Monitor")
        self._create_monitor_environment(non_muted_monitor_1, name="prod")
        non_muted_monitor_2 = self._create_monitor(name="A monitor")
        self._create_monitor_environment(non_muted_monitor_2, name="prod")
        muted_env_monitor = self._create_monitor(name="Some Muted Env Monitor")
        self._create_monitor_environment(
            muted_env_monitor,
            name="prod",
            is_muted=True,
        )
        not_muted_env_monitor = self._create_monitor(name="ZA monitor")
        self._create_monitor_environment(
            not_muted_env_monitor,
            name="prod",
            is_muted=False,
        )
        muted_other_env_monitor = self._create_monitor(name="Some muted other Env Monitor")
        self._create_monitor_environment(muted_other_env_monitor, name="prod")
        self._create_monitor_environment(
            muted_other_env_monitor,
            name="dev",
            is_muted=True,
        )

        response = self.get_success_response(self.organization.slug, sort="muted")
        expected = [
            non_muted_monitor_2,
            non_muted_monitor_1,
            not_muted_env_monitor,
            muted_env_monitor,
            muted_other_env_monitor,
            muted_monitor_2,
            muted_monitor_1,
        ]
        self.check_valid_response(response, expected)

        expected.reverse()
        response = self.get_success_response(self.organization.slug, sort="muted", asc="0")
        self.check_valid_response(response, expected)

        response = self.get_success_response(
            self.organization.slug, sort="muted", environment=["prod"]
        )
        expected = [
            non_muted_monitor_2,
            non_muted_monitor_1,
            muted_other_env_monitor,
            not_muted_env_monitor,
            muted_env_monitor,
            muted_monitor_2,
            muted_monitor_1,
        ]
        self.check_valid_response(response, expected)

        expected.reverse()
        response = self.get_success_response(
            self.organization.slug, sort="muted", environment=["prod"], asc="0"
        )
        self.check_valid_response(response, expected)

    def test_environments_sorted(self):
        last_checkin = datetime.now(UTC) - timedelta(minutes=1)

        monitor = self._create_monitor(
            status=ObjectStatus.ACTIVE,
            name="A monitor",
        )
        env_error = self._create_monitor_environment(
            monitor,
            name="jungle",
            last_checkin=last_checkin - timedelta(seconds=30),
            status=MonitorStatus.ERROR,
        )
        env_muted = self._create_monitor_environment(
            monitor,
            name="tree",
            last_checkin=last_checkin - timedelta(seconds=45),
            status=MonitorStatus.OK,
            is_muted=True,
        )
        env_ok_older = self._create_monitor_environment(
            monitor,
            name="vines",
            last_checkin=last_checkin - timedelta(seconds=20),
            status=MonitorStatus.OK,
        )
        env_ok_newer = self._create_monitor_environment(
            monitor,
            name="volcano",
            last_checkin=last_checkin - timedelta(seconds=15),
            status=MonitorStatus.OK,
        )

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])
        self.check_valid_environments_response(
            response, response.data[0], [env_error, env_ok_newer, env_ok_older, env_muted]
        )

    def test_filter_owners(self):
        user_1 = self.create_user()
        user_2 = self.create_user()
        team_1 = self.create_team()
        team_2 = self.create_team()
        self.create_team_membership(team_2, user=self.user)

        mon_a = self._create_monitor(name="A monitor", owner_user_id=user_1.id)
        mon_b = self._create_monitor(name="B monitor", owner_user_id=user_2.id)
        mon_c = self._create_monitor(name="C monitor", owner_user_id=None, owner_team_id=team_1.id)
        mon_d = self._create_monitor(name="D monitor", owner_user_id=None, owner_team_id=team_2.id)
        mon_e = self._create_monitor(name="E monitor", owner_user_id=None, owner_team_id=None)

        # Monitor by user
        response = self.get_success_response(self.organization.slug, owner=[f"user:{user_1.id}"])
        self.check_valid_response(response, [mon_a])

        # Monitors by users and teams
        response = self.get_success_response(
            self.organization.slug,
            owner=[f"user:{user_1.id}", f"user:{user_2.id}", f"team:{team_1.id}"],
        )
        self.check_valid_response(response, [mon_a, mon_b, mon_c])

        # myteams
        response = self.get_success_response(
            self.organization.slug,
            owner=["myteams"],
        )
        self.check_valid_response(response, [mon_d])

        # unassigned monitors
        response = self.get_success_response(
            self.organization.slug,
            owner=["unassigned", f"user:{user_1.id}"],
        )
        self.check_valid_response(response, [mon_a, mon_e])

        # Invalid user ID
        response = self.get_success_response(
            self.organization.slug,
            owner=["user:12345"],
        )
        self.check_valid_response(response, [])

    def test_all_monitor_environments(self):
        monitor = self._create_monitor()
        monitor_environment = self._create_monitor_environment(
            monitor, name="test", status=MonitorStatus.OK
        )

        monitor_empty = self._create_monitor(name="empty")

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor, monitor_empty])
        self.check_valid_environments_response(response, response.data[0], [monitor_environment])
        self.check_valid_environments_response(response, response.data[1], [])

    def test_monitor_environment(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(monitor)

        monitor_hidden = self._create_monitor(name="hidden")
        self._create_monitor_environment(monitor_hidden, name="hidden")

        response = self.get_success_response(self.organization.slug, environment="production")
        self.check_valid_response(response, [monitor])

    def test_monitor_environment_include_new(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(
            monitor, status=MonitorStatus.OK, last_checkin=datetime.now(UTC) - timedelta(minutes=1)
        )

        monitor_visible = self._create_monitor(name="visible")

        response = self.get_success_response(
            self.organization.slug, environment="production", includeNew=True
        )
        self.check_valid_response(response, [monitor, monitor_visible])

    def test_search_by_slug(self):
        monitor = self._create_monitor(slug="test-slug")
        self._create_monitor(slug="other-monitor")

        response = self.get_success_response(self.organization.slug, query="test-slug")
        self.check_valid_response(response, [monitor])

    def test_ignore_pending_deletion_environments(self):
        monitor = self._create_monitor()
        self._create_monitor_environment(
            monitor,
            status=MonitorStatus.OK,
            last_checkin=datetime.now(UTC) - timedelta(minutes=1),
        )
        self._create_monitor_environment(
            monitor,
            status=MonitorStatus.PENDING_DELETION,
            name="deleted_environment",
            last_checkin=datetime.now(UTC) - timedelta(minutes=1),
        )

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [monitor])
        # Confirm we only see the one 'ok' environment
        assert len(response.data[0]["environments"]) == 1
        assert response.data[0]["environments"][0]["status"] == "ok"


class CreateOrganizationMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-index"
    method = "post"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    @patch("sentry.analytics.record")
    def test_simple(self, mock_record):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "owner": f"user:{self.user.id}",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data)

        monitor = Monitor.objects.get(slug=response.data["slug"])
        assert monitor.organization_id == self.organization.id
        assert monitor.project_id == self.project.id
        assert monitor.name == "My Monitor"
        assert monitor.status == ObjectStatus.ACTIVE
        assert monitor.owner_user_id == self.user.id
        assert monitor.owner_team_id is None
        assert monitor.type == MonitorType.CRON_JOB
        assert monitor.config == {
            "schedule_type": ScheduleType.CRONTAB,
            "schedule": "0 0 * * *",
            "checkin_margin": None,
            "max_runtime": None,
            "failure_issue_threshold": None,
            "recovery_threshold": None,
        }

        self.project.refresh_from_db()
        assert self.project.flags.has_cron_monitors

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
        response = self.get_success_response(self.organization.slug, **data)

        assert response.data["slug"] == "my-monitor"

    def test_invalid_numeric_slug(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert response.data["slug"][0] == DEFAULT_SLUG_ERROR_MESSAGE

    def test_generated_slug_not_entirely_numeric(self):
        data = {
            "project": self.project.slug,
            "name": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        slug = response.data["slug"]
        assert slug.startswith("1234-")
        assert not slug.isdecimal()

    def test_crontab_whitespace(self):
        data = {
            "project": self.project.slug,
            "name": "1234",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "  *\t* *     * * "},
        }
        response = self.get_success_response(self.organization.slug, **data, status_code=201)

        schedule = response.data["config"]["schedule"]
        assert schedule == "* * * * *"

    @override_settings(MAX_MONITORS_PER_ORG=2)
    def test_monitor_organization_limit(self):
        for i in range(settings.MAX_MONITORS_PER_ORG):
            data = {
                "project": self.project.slug,
                "name": f"Unicron-{i}",
                "slug": f"unicron-{i}",
                "type": "cron_job",
                "config": {"schedule_type": "crontab", "schedule": "@daily"},
            }
            self.get_success_response(self.organization.slug, **data)

        data = {
            "project": self.project.slug,
            "name": f"Unicron-{settings.MAX_MONITORS_PER_ORG + 1}",
            "slug": f"unicron-{settings.MAX_MONITORS_PER_ORG + 1}",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        self.get_error_response(self.organization.slug, status_code=403, **data)

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
        response = self.get_success_response(self.organization.slug, **data)

        monitor = Monitor.objects.get(slug=response.data["slug"])
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
        # validator this test will chagne to a get_error_response test.
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "slug": "cron_job",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily", "checkin_margin": 0},
        }
        response = self.get_success_response(self.organization.slug, **data)
        assert Monitor.objects.get(slug=response.data["slug"]).config["checkin_margin"] == 1

    @patch("sentry.quotas.backend.assign_monitor_seat")
    def test_create_monitor_assigns_seat(self, assign_monitor_seat):
        assign_monitor_seat.return_value = Outcome.ACCEPTED

        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            "config": {"schedule_type": "crontab", "schedule": "@daily"},
        }
        response = self.get_success_response(self.organization.slug, **data)

        monitor = Monitor.objects.get(slug=response.data["slug"])

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
        response = self.get_success_response(self.organization.slug, **data)

        monitor = Monitor.objects.get(slug=response.data["slug"])

        assert assign_monitor_seat.called
        assert response.data["status"] == "disabled"
        assert monitor.status == ObjectStatus.DISABLED

    def test_invalid_schedule(self):
        data = {
            "project": self.project.slug,
            "name": "My Monitor",
            "type": "cron_job",
            # There is no Febuary 31st
            "config": {"schedule_type": "crontab", "schedule": "0 0 31 2 *"},
        }
        response = self.get_error_response(self.organization.slug, **data, status_code=400)
        assert response.data["config"]["schedule"][0] == "Schedule is invalid"


class BulkEditOrganizationMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-index"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_valid_ids(self):
        monitor_one = self._create_monitor(slug="monitor_one")
        self._create_monitor(slug="monitor_two")

        data = {
            "ids": [uuid.uuid4().hex, monitor_one.guid],
            "isMuted": True,
        }
        response = self.get_error_response(self.organization.slug, **data)
        assert response.status_code == 400
        assert response.data == {
            "ids": [
                ErrorDetail(string="Not all ids are valid for this organization.", code="invalid")
            ]
        }

    def test_bulk_mute_unmute(self):
        monitor_one = self._create_monitor(slug="monitor_one")
        monitor_two = self._create_monitor(slug="monitor_two")

        data = {
            "ids": [monitor_one.guid, monitor_two.guid],
            "isMuted": True,
        }
        with outbox_runner():
            response = self.get_success_response(self.organization.slug, **data)
            assert response.status_code == 200

        monitor_one.refresh_from_db()
        monitor_two.refresh_from_db()
        assert monitor_one.is_muted
        assert monitor_two.is_muted
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MONITOR_EDIT"),
            data=monitor_one.get_audit_log_data(),
        )
        assert_org_audit_log_exists(
            organization=self.organization,
            event=audit_log.get_event_id("MONITOR_EDIT"),
            data=monitor_two.get_audit_log_data(),
        )

        data = {
            "ids": [monitor_one.guid, monitor_two.guid],
            "isMuted": False,
        }
        response = self.get_success_response(self.organization.slug, **data)
        assert response.status_code == 200

        monitor_one.refresh_from_db()
        monitor_two.refresh_from_db()
        assert not monitor_one.is_muted
        assert not monitor_two.is_muted

    def test_bulk_disable_enable(self):
        monitor_one = self._create_monitor(slug="monitor_one")
        monitor_two = self._create_monitor(slug="monitor_two")
        data = {
            "ids": [monitor_one.guid, monitor_two.guid],
            "status": "disabled",
        }
        response = self.get_success_response(self.organization.slug, **data)
        assert response.status_code == 200

        monitor_one.refresh_from_db()
        monitor_two.refresh_from_db()
        assert monitor_one.status == ObjectStatus.DISABLED
        assert monitor_two.status == ObjectStatus.DISABLED

        data = {
            "ids": [monitor_one.guid, monitor_two.guid],
            "status": "active",
        }
        response = self.get_success_response(self.organization.slug, **data)

        assert response.status_code == 200

        monitor_one.refresh_from_db()
        monitor_two.refresh_from_db()
        assert monitor_one.status == ObjectStatus.ACTIVE
        assert monitor_two.status == ObjectStatus.ACTIVE

    @patch("sentry.quotas.backend.check_assign_monitor_seats")
    def test_enable_no_quota(self, check_assign_monitor_seats):
        monitor_one = self._create_monitor(slug="monitor_one", status=ObjectStatus.DISABLED)
        monitor_two = self._create_monitor(slug="monitor_two", status=ObjectStatus.DISABLED)
        result = SeatAssignmentResult(
            assignable=False,
            reason="Over quota",
        )
        check_assign_monitor_seats.return_value = result

        data = {
            "ids": [monitor_one.guid, monitor_two.guid],
            "status": "active",
        }
        response = self.get_error_response(self.organization.slug, **data)
        assert response.status_code == 400
        assert response.data == "Over quota"

        # Verify monitors are still disabled
        monitor_one.refresh_from_db()
        monitor_two.refresh_from_db()
        assert monitor_one.status == ObjectStatus.DISABLED
        assert monitor_two.status == ObjectStatus.DISABLED

    def test_disallow_when_no_open_membership(self):
        monitor = self._create_monitor()

        # disable Open Membership
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        # user has no access to all the projects
        user_no_team = self.create_user(is_superuser=False)
        self.create_member(
            user=user_no_team, organization=self.organization, role="member", teams=[]
        )
        self.login_as(user_no_team)

        data = {
            "ids": [monitor.guid],
            "isMuted": True,
        }
        response = self.get_success_response(self.organization.slug, **data)
        assert response.status_code == 200
        assert response.data == {"updated": [], "errored": []}

        monitor.refresh_from_db()
        assert not monitor.is_muted
