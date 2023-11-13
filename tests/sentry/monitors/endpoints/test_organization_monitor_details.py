import pytest

from sentry.api.fields.sentry_slug import DEFAULT_SLUG_ERROR_MESSAGE
from sentry.models.environment import Environment
from sentry.models.rule import Rule, RuleActivity, RuleActivityType
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorObjectStatus, ScheduleType
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMonitorDetailsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.slug)
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
        self._create_monitor_environment(monitor, name="production")
        self._create_monitor_environment(monitor, name="jungle")

        response = self.get_success_response(self.organization.slug, monitor.slug)
        assert len(response.data["environments"]) == 2

        response = self.get_success_response(
            self.organization.slug, monitor.slug, environment="production"
        )
        assert len(response.data["environments"]) == 1

    def test_expand_alert_rule(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.slug, expand=["alertRule"])
        assert resp.data["alertRule"] is None

        self._create_alert_rule(monitor)
        resp = self.get_success_response(self.organization.slug, monitor.slug, expand=["alertRule"])
        alert_rule = resp.data["alertRule"]
        assert alert_rule is not None
        assert alert_rule["environment"] is not None


@region_silo_test(stable=True)
class UpdateMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

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

    def test_can_disable(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "disabled"}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorObjectStatus.DISABLED

    def test_can_enable(self):
        monitor = self._create_monitor()

        monitor.update(status=MonitorObjectStatus.DISABLED)

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"status": "active"}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorObjectStatus.ACTIVE

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

    def test_max_runtime(self):
        monitor = self._create_monitor()

        resp = self.get_error_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            status_code=400,
            **{"config": {"max_runtime": -1}},
        )

        resp = self.get_success_response(
            self.organization.slug, monitor.slug, method="PUT", **{"config": {"max_runtime": 30}}
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["max_runtime"] == 30

    def test_existing_alert_rule(self):
        monitor = self._create_monitor()
        rule = self._create_alert_rule(monitor)
        new_environment = self.create_environment(name="jungle")
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            method="PUT",
            **{
                "alert_rule": {
                    "targets": [{"targetIdentifier": self.user.id, "targetType": "Member"}],
                    "environment": new_environment.name,
                }
            },
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        monitor_rule = monitor.get_alert_rule()
        assert monitor_rule.id == rule.id
        assert monitor_rule.data["actions"] != rule.data["actions"]
        # Verify the conditions haven't changed
        assert monitor_rule.data["conditions"] == rule.data["conditions"]
        rule_environment = Environment.objects.get(id=monitor_rule.environment_id)
        assert rule_environment.name == new_environment.name

    def test_without_existing_alert_rule(self):
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
        rule = monitor.get_alert_rule()
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


@region_silo_test()
class DeleteMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

    def setUp(self):
        self.login_as(user=self.user)
        super().setUp()

    def test_simple(self):
        monitor = self._create_monitor()
        old_slug = monitor.slug

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorObjectStatus.PENDING_DELETION
        # Slug should update on deletion
        assert monitor.slug != old_slug
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor.id, model_name="Monitor"
        ).exists()

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
        assert monitor.status == MonitorObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorObjectStatus.PENDING_DELETION
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
        assert monitor.status == MonitorObjectStatus.ACTIVE

        monitor_environment_a = MonitorEnvironment.objects.get(id=monitor_environment_a.id)
        assert monitor_environment_a.status == MonitorObjectStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment_a.id, model_name="MonitorEnvironment"
        ).exists()

        monitor_environment_b = MonitorEnvironment.objects.get(id=monitor_environment_b.id)
        assert monitor_environment_b.status == MonitorObjectStatus.PENDING_DELETION
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

    def test_simple_with_alert_rule(self):
        monitor = self._create_monitor()
        self._create_alert_rule(monitor)

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        rule = Rule.objects.get(project_id=monitor.project_id, id=monitor.config["alert_rule_id"])
        assert rule.status == MonitorObjectStatus.PENDING_DELETION
        assert RuleActivity.objects.filter(rule=rule, type=RuleActivityType.DELETED.value).exists()

    def test_simple_with_alert_rule_deleted(self):
        monitor = self._create_monitor()
        rule = self._create_alert_rule(monitor)
        rule.delete()

        self.get_success_response(
            self.organization.slug, monitor.slug, method="DELETE", status_code=202
        )

        with pytest.raises(Rule.DoesNotExist):
            Rule.objects.get(project_id=monitor.project_id, id=monitor.config["alert_rule_id"])
