from sentry.constants import ObjectStatus
from sentry.models.scheduledeletion import RegionScheduledDeletion
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorStatus
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time()
class BaseUpdateMonitorEnvironmentTest(MonitorTestCase):
    __test__ = False

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        monitor = self._create_monitor(status=MonitorStatus.ACTIVE)
        monitor_environment = self._create_monitor_environment(monitor)
        # Test disable
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            monitor_environment.get_environment().name,
            method="PUT",
            **{"isMuted": True},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.is_muted is True

        # Test activate
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            monitor_environment.get_environment().name,
            method="PUT",
            **{"isMuted": False},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.is_muted is False

        # Test other status
        resp = self.get_success_response(
            self.organization.slug,
            monitor.slug,
            monitor_environment.get_environment().name,
            method="PUT",
            **{"status": "error"},
        )
        assert resp.data["slug"] == monitor.slug

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.ACTIVE


class BaseDeleteMonitorTest(MonitorTestCase):
    __test__ = False

    def setUp(self):
        self.login_as(user=self.user)
        super().setUp()

    def test_simple(self):
        monitor = self._create_monitor(status=MonitorStatus.ACTIVE)
        monitor_environment = self._create_monitor_environment(monitor)
        monitor_environment_2 = self._create_monitor_environment(monitor, name="second")

        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            monitor_environment.get_environment().name,
            method="DELETE",
            status_code=202,
        )

        monitor = Monitor.objects.get(id=monitor.id)
        assert monitor.status == ObjectStatus.ACTIVE

        monitor_environment = MonitorEnvironment.objects.get(id=monitor_environment.id)
        assert monitor_environment.status == MonitorStatus.PENDING_DELETION
        assert RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment.id, model_name="MonitorEnvironment"
        ).exists()

        monitor_environment_2 = MonitorEnvironment.objects.get(id=monitor_environment_2.id)
        assert monitor_environment_2.status == MonitorStatus.ACTIVE
        assert not RegionScheduledDeletion.objects.filter(
            object_id=monitor_environment_2.id, model_name="MonitorEnvironment"
        ).exists()
