from __future__ import annotations

from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertCountTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index-count"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)

    def test_simple(self):
        self.create_detector(
            name="Active Alert 1",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=True,
            config={"environment": self.environment.name, "mode": 1},
        )
        self.create_detector(
            name="Active Alert 2",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=True,
            config={"environment": self.environment.name, "mode": 1},
        )
        self.create_detector(
            name="Disabled Alert",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=False,
            config={"environment": self.environment.name, "mode": 1},
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

        self.create_detector(
            name="Alert 1",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=True,
            config={"environment": env1.name, "mode": 1},
        )
        self.create_detector(
            name="Alert 2",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=True,
            config={"environment": env2.name, "mode": 1},
        )
        self.create_detector(
            name="Alert 3",
            type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
            enabled=False,
            config={"environment": env1.name, "mode": 1},
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
