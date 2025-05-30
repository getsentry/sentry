from __future__ import annotations

from sentry.constants import ObjectStatus
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertCountTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index-count"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        self.create_project_uptime_subscription(name="Active Alert 1")
        self.create_project_uptime_subscription(name="Active Alert 2")
        self.create_project_uptime_subscription(name="Disabled Alert", status=ObjectStatus.DISABLED)

        # Uptime alerts pending deletion should be excluded
        self.create_project_uptime_subscription(
            name="Pending Deletion", status=ObjectStatus.PENDING_DELETION
        )

        response = self.get_success_response(self.organization.slug)

        assert response.data == {
            "counts": {
                "total": 3,
                "active": 2,
                "disabled": 1,
            },
        }

    def test_filtered_by_environment(self):
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        self.create_project_uptime_subscription(name="Alert 1", env=env1)
        self.create_project_uptime_subscription(name="Alert 2", env=env2)
        self.create_project_uptime_subscription(
            name="Alert 3", env=env1, status=ObjectStatus.DISABLED
        )

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
