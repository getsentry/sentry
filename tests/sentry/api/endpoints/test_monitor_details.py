from sentry.models import Monitor, MonitorStatus, ScheduledDeletion, ScheduleType
from sentry.testutils import MonitorTestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class MonitorDetailsTest(MonitorTestCase):
    endpoint = "sentry-api-0-monitor-details"
    endpoint_with_org = "sentry-api-0-monitor-details-with-org"

    def setUp(self):
        super().setUp()

    def test_simple(self):
        self.login_as(user=self.user)
        monitor = self._create_monitor()

        for path_func in self._get_path_functions():
            path = path_func(monitor)
            resp = self.client.get(path)

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/"
        self.login_as(user=self.user)

        resp = self.client.get(path)

        assert resp.status_code == 400


@region_silo_test(stable=True)
class UpdateMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-monitor-details"
    endpoint_with_org = "sentry-api-0-monitor-details-with-org"

    def setUp(self):
        super().setUp()

        self.login_as(user=self.user)

    def test_name(self):
        monitor = self._create_monitor()

        for i, path_func in enumerate(self._get_path_functions()):
            monitor = self._create_monitor()
            path = path_func(monitor)
            resp = self.client.put(path, data={"name": f"Monitor Name {i}"})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.name == f"Monitor Name {i}"

    def test_can_disable(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)
            resp = self.client.put(path, data={"status": "disabled"})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.DISABLED

    def test_can_enable(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            monitor.update(status=MonitorStatus.DISABLED)

            resp = self.client.put(path, data={"status": "active"})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.ACTIVE

    def test_cannot_enable_if_enabled(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            monitor.update(status=MonitorStatus.OK)

            resp = self.client.put(path, data={"status": "active"})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.OK

    def test_checkin_margin(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"checkin_margin": 30}})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.config["checkin_margin"] == 30

    def test_max_runtime(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"max_runtime": 30}})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.config["max_runtime"] == 30

    def test_invalid_config_param(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"invalid": True}})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert "invalid" not in monitor.config

    def test_cronjob_crontab(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"schedule": "*/5 * * * *"}})

            assert resp.status_code == 200, resp.content
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
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"schedule": "@monthly"}})

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.config["schedule_type"] == ScheduleType.CRONTAB
            assert monitor.config["schedule"] == "0 0 1 * *"

    def test_cronjob_crontab_invalid(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(path, data={"config": {"schedule": "*/0.5 * * * *"}})

            assert resp.status_code == 400, resp.content

            resp = self.client.put(path, data={"config": {"schedule": "* * * *"}})

            assert resp.status_code == 400, resp.content

    def test_cronjob_interval(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(
                path, data={"config": {"schedule_type": "interval", "schedule": [1, "month"]}}
            )

            assert resp.status_code == 200, resp.content
            assert resp.data["id"] == str(monitor.guid)

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.config["schedule_type"] == ScheduleType.INTERVAL
            assert monitor.config["schedule"] == [1, "month"]

    def test_cronjob_interval_invalid_inteval(self):
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.put(
                path, data={"config": {"schedule_type": "interval", "schedule": [1, "decade"]}}
            )

            assert resp.status_code == 400, resp.content

            resp = self.client.put(
                path,
                data={"config": {"schedule_type": "interval", "schedule": ["foo", "month"]}},
            )

            assert resp.status_code == 400, resp.content

            resp = self.client.put(
                path, data={"config": {"schedule_type": "interval", "schedule": "bar"}}
            )

            assert resp.status_code == 400, resp.content

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/"
        self.login_as(user=self.user)

        resp = self.client.put(
            path, data={"config": {"schedule_type": "interval", "schedule": [1, "month"]}}
        )

        assert resp.status_code == 400


@region_silo_test()
class DeleteMonitorTest(MonitorTestCase):
    endpoint = "sentry-api-0-monitor-details"
    endpoint_with_org = "sentry-api-0-monitor-details-with-org"

    def setUp(self):
        super().setUp()

    def test_simple(self):
        self.login_as(user=self.user)
        for path_func in self._get_path_functions():
            monitor = self._create_monitor()
            path = path_func(monitor)

            resp = self.client.delete(path)

            assert resp.status_code == 202, resp.content

            monitor = Monitor.objects.get(id=monitor.id)
            assert monitor.status == MonitorStatus.PENDING_DELETION
            # ScheduledDeletion only available in control silo
            assert ScheduledDeletion.objects.filter(
                object_id=monitor.id, model_name="Monitor"
            ).exists()

    def test_mismatched_org_slugs(self):
        monitor = self._create_monitor()
        path = f"/api/0/monitors/asdf/{monitor.guid}/"
        self.login_as(user=self.user)

        resp = self.client.delete(path)

        assert resp.status_code == 400
