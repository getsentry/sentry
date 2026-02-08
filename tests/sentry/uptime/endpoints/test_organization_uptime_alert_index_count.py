from __future__ import annotations

from sentry.testutils.helpers import with_feature
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


@with_feature("organizations:uptime-runtime-assertions")
class OrganizationUptimeAlertCountTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index-count"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_simple(self) -> None:
        self.create_uptime_detector(
            name="Active Alert 1",
            enabled=True,
            env=self.environment,
        )
        self.create_uptime_detector(
            name="Active Alert 2",
            enabled=True,
            env=self.environment,
        )
        self.create_uptime_detector(
            name="Disabled Alert",
            enabled=False,
            env=self.environment,
        )

        response = self.get_success_response(self.organization.slug)

        assert response.data == {
            "counts": {
                "total": 3,
                "active": 2,
                "disabled": 1,
            },
        }

    def test_filtered_by_environment(self) -> None:
        env1 = self.create_environment(name="production")
        env2 = self.create_environment(name="staging")

        self.create_uptime_detector(
            name="Alert 1",
            enabled=True,
            env=env1,
        )
        self.create_uptime_detector(
            name="Alert 2",
            enabled=True,
            env=env2,
        )
        self.create_uptime_detector(
            name="Alert 3",
            enabled=False,
            env=env1,
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
