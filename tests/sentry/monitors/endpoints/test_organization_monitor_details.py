from sentry.models import ScheduledDeletion
from sentry.monitors.models import Monitor, MonitorStatus, ScheduleType
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class OrganizationMonitorDetailsTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(self.organization.slug, monitor.guid)
        assert resp.data["id"] == str(monitor.guid)

    def test_simple_slug(self):
        monitor = self._create_monitor(slug="my-monitor")

        resp = self.get_success_response(self.organization.slug, monitor.slug)
        assert resp.data["id"] == str(monitor.guid)
        assert resp.data["slug"] == "my-monitor"

        # GUID based lookup also works
        resp = self.get_success_response(self.organization.slug, monitor.guid)
        assert resp.data["id"] == str(monitor.guid)
        assert resp.data["slug"] == "my-monitor"

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        self.get_error_response("asdf", monitor.guid, status_code=404)

    def test_invalid_monitor_id(self):
        self._create_monitor()
        self.get_error_response(self.organization.slug, "bad-guid", status_code=400)


@region_silo_test(stable=True)
class UpdateMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_name(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"name": "Monitor Name"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.name == "Monitor Name"

    def test_slug(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"slug": "my-monitor"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.slug == "my-monitor"

        # Validate error cases jsut to be safe
        self.get_error_response(
            self.organization.slug, monitor.guid, method="PUT", status_code=400, **{"slug": ""}
        )
        self.get_error_response(
            self.organization.slug, monitor.guid, method="PUT", status_code=400, **{"slug": None}
        )

    def test_can_disable(self):
        monitor = self._create_monitor()
        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"status": "disabled"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.DISABLED

    def test_can_enable(self):
        monitor = self._create_monitor()

        monitor.update(status=MonitorStatus.DISABLED)

        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"status": "active"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.ACTIVE

    def test_cannot_enable_if_enabled(self):
        monitor = self._create_monitor()

        monitor.update(status=MonitorStatus.OK)

        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"status": "active"}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.OK

    def test_timezone(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            **{"config": {"timezone": "America/Los_Angeles"}},
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["timezone"] == "America/Los_Angeles"

    def test_checkin_margin(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            **{"config": {"checkin_margin": 30}},
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["checkin_margin"] == 30

    def test_max_runtime(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"config": {"max_runtime": 30}}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["max_runtime"] == 30

    def test_invalid_config_param(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug, monitor.guid, method="PUT", **{"config": {"invalid": True}}
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert "invalid" not in monitor.config

    def test_cronjob_crontab(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            **{"config": {"schedule": "*/5 * * * *"}},
        )
        assert resp.data["id"] == str(monitor.guid)

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
            monitor.guid,
            method="PUT",
            **{"config": {"schedule": "@monthly"}},
        )
        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
        assert monitor.config["schedule"] == "0 0 1 * *"

    def test_cronjob_crontab_invalid(self):
        monitor = self._create_monitor()

        self.get_error_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "*/0.5 * * * *"}},
        )
        self.get_error_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            status_code=400,
            **{"config": {"schedule": "* * * *"}},
        )

    def test_cronjob_interval(self):
        monitor = self._create_monitor()

        resp = self.get_success_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            **{"config": {"schedule_type": "interval", "schedule": [1, "month"]}},
        )

        assert resp.data["id"] == str(monitor.guid)

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.config["schedule_type"] == ScheduleType.INTERVAL
        assert monitor.config["schedule"] == [1, "month"]

    def test_cronjob_interval_invalid_inteval(self):
        monitor = self._create_monitor()

        self.get_error_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": [1, "decade"]}},
        )

        self.get_error_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": ["foo", "month"]}},
        )

        self.get_error_response(
            self.organization.slug,
            monitor.guid,
            method="PUT",
            status_code=400,
            **{"config": {"schedule_type": "interval", "schedule": "bar"}},
        )

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()

        self.get_error_response(
            "asdf",
            monitor.guid,
            method="PUT",
            status_code=404,
            **{"config": {"schedule_type": "interval", "schedule": [1, "month"]}},
        )

    def test_cannot_change_project(self):
        monitor = self._create_monitor()

        project2 = self.create_project()
        resp = self.get_error_response(
            self.organization.slug,
            monitor.guid,
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

        self.get_success_response(
            self.organization.slug, monitor.guid, method="DELETE", status_code=202
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == MonitorStatus.PENDING_DELETION
        # ScheduledDeletion only available in control silo
        assert ScheduledDeletion.objects.filter(object_id=monitor.id, model_name="Monitor").exists()

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        self.get_error_response("asdf", monitor.guid, status_code=404)
