from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.monitors.models import Monitor, MonitorEnvironment, MonitorStatus, is_monitor_muted
from sentry.testutils.cases import MonitorTestCase
from sentry.testutils.helpers.datetime import freeze_time


@freeze_time()
class BaseUpdateMonitorEnvironmentTest(MonitorTestCase):
    __test__ = False

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self) -> None:
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

    def test_muting_all_environments_mutes_monitor(self) -> None:
        """Test that muting all environments also mutes the monitor."""
        monitor = self._create_monitor(status=MonitorStatus.ACTIVE)
        env1 = self._create_monitor_environment(monitor, name="production")
        env2 = self._create_monitor_environment(monitor, name="staging")

        # Initially monitor should be unmuted
        monitor.refresh_from_db()
        assert is_monitor_muted(monitor) is False

        # Mute first environment
        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            env1.get_environment().name,
            method="PUT",
            **{"isMuted": True},
        )

        # Monitor should still be unmuted (one environment is unmuted)
        monitor.refresh_from_db()
        assert is_monitor_muted(monitor) is False

        # Mute second environment
        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            env2.get_environment().name,
            method="PUT",
            **{"isMuted": True},
        )

        # Now monitor should be muted (all environments are muted)
        monitor.refresh_from_db()
        assert is_monitor_muted(monitor) is True

    def test_unmuting_one_environment_unmutes_monitor(self) -> None:
        """Test that unmuting one environment when all were muted also unmutes the monitor."""
        # Start with a monitor that has all environments muted
        monitor = self._create_monitor(status=MonitorStatus.ACTIVE)

        # Create two muted environments
        env1 = self._create_monitor_environment(monitor, name="production", is_muted=True)
        env2 = self._create_monitor_environment(monitor, name="staging", is_muted=True)

        # Verify initial state
        monitor.refresh_from_db()
        assert is_monitor_muted(monitor) is True

        # Unmute one environment via the endpoint
        self.get_success_response(
            self.organization.slug,
            monitor.slug,
            env1.get_environment().name,
            method="PUT",
            **{"isMuted": False},
        )

        # Monitor should now be unmuted
        monitor = Monitor.objects.get(id=monitor.id)
        assert is_monitor_muted(monitor) is False
        env1.refresh_from_db()
        assert env1.is_muted is False
        env2.refresh_from_db()
        assert env2.is_muted is True


class BaseDeleteMonitorTest(MonitorTestCase):
    __test__ = False

    def setUp(self) -> None:
        self.login_as(user=self.user)
        super().setUp()

    def test_simple(self) -> None:
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
