from sentry.api.serializers import serialize
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index"


class OrganizationUptimeAlertIndexEndpointTest(OrganizationUptimeAlertIndexBaseEndpointTest):
    method = "get"

    def check_valid_response(self, response, expected_alerts):
        assert [serialize(uptime_alert) for uptime_alert in expected_alerts] == response.data

    def test(self):
        alert_1 = self.create_project_uptime_subscription(name="test1")
        alert_2 = self.create_project_uptime_subscription(name="test2")
        resp = self.get_success_response(self.organization.slug)
        self.check_valid_response(resp, [alert_1, alert_2])

    def test_search_by_url(self):
        self.create_project_uptime_subscription()
        santry_monitor = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(url="https://santry.com")
        )

        response = self.get_success_response(self.organization.slug, query="santry")
        self.check_valid_response(response, [santry_monitor])

    def test_environment_filter(self):
        env = self.create_environment()
        self.create_project_uptime_subscription()
        env_monitor = self.create_project_uptime_subscription(env=env)

        response = self.get_success_response(self.organization.slug, environment=[env.name])
        self.check_valid_response(response, [env_monitor])

    def test_owner_filter(self):
        user_1 = self.create_user()
        user_2 = self.create_user()
        team_1 = self.create_team()
        team_2 = self.create_team()
        self.create_team_membership(team_2, user=self.user)

        uptime_a = self.create_project_uptime_subscription(owner=user_1)
        uptime_b = self.create_project_uptime_subscription(owner=user_2)
        uptime_c = self.create_project_uptime_subscription(owner=team_1)
        uptime_d = self.create_project_uptime_subscription(owner=team_2)
        uptime_e = self.create_project_uptime_subscription(owner=None)

        # Monitor by user
        response = self.get_success_response(self.organization.slug, owner=[f"user:{user_1.id}"])
        self.check_valid_response(response, [uptime_a])

        # Monitors by users and teams
        response = self.get_success_response(
            self.organization.slug,
            owner=[f"user:{user_1.id}", f"user:{user_2.id}", f"team:{team_1.id}"],
        )
        self.check_valid_response(response, [uptime_a, uptime_b, uptime_c])

        # myteams
        response = self.get_success_response(
            self.organization.slug,
            owner=["myteams"],
        )
        self.check_valid_response(response, [uptime_d])

        # unassigned monitors
        response = self.get_success_response(
            self.organization.slug,
            owner=["unassigned", f"user:{user_1.id}"],
        )
        self.check_valid_response(response, [uptime_a, uptime_e])

        # Invalid user ID
        response = self.get_success_response(
            self.organization.slug,
            owner=["user:12345"],
        )
        self.check_valid_response(response, [])
