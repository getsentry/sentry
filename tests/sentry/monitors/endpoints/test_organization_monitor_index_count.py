from __future__ import annotations

from sentry.constants import ObjectStatus
from sentry.testutils.cases import MonitorTestCase


class OrganizationMonitorsCountTest(MonitorTestCase):
    endpoint = "sentry-api-0-organization-monitor-index-count"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        self._create_monitor(name="Active Monitor 1")
        self._create_monitor(name="Active Monitor 2")
        self._create_monitor(name="Disabled Monitor", status=ObjectStatus.DISABLED)

        # Monitors pending deletion should be excluded
        self._create_monitor(name="Pending Deletion", status=ObjectStatus.PENDING_DELETION)

        response = self.get_success_response(self.organization.slug)

        assert response.data == {
            "counts": {
                "total": 3,
                "active": 2,
                "disabled": 1,
            },
        }

    def test_filtered_by_environment(self):
        # Create monitors with different environments
        monitor1 = self._create_monitor(name="Monitor 1")
        monitor2 = self._create_monitor(name="Monitor 2")
        monitor3 = self._create_monitor(name="Monitor 3", status=ObjectStatus.DISABLED)

        self._create_monitor_environment(monitor1, name="production")
        self._create_monitor_environment(monitor2, name="staging")
        self._create_monitor_environment(monitor3, name="production")

        response = self.get_success_response(self.organization.slug, environment=["production"])

        assert response.data == {
            "counts": {
                "total": 2,
                "active": 1,
                "disabled": 1,
            },
        }

        response = self.get_success_response(self.organization.slug, environment=["staging"])

        assert response.data == {
            "counts": {
                "total": 1,
                "active": 1,
                "disabled": 0,
            },
        }
