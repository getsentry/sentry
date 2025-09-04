from sentry.api.serializers import serialize
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.models import get_detector
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index"


class OrganizationUptimeAlertIndexEndpointTest(OrganizationUptimeAlertIndexBaseEndpointTest):
    method = "get"

    def check_valid_response(self, response, expected_detectors):
        assert [
            serialize(uptime_alert, serializer=UptimeDetectorSerializer())
            for uptime_alert in expected_detectors
        ] == response.data

    def test(self) -> None:
        alert_1 = self.create_project_uptime_subscription(name="test1")
        alert_2 = self.create_project_uptime_subscription(name="test2")
        resp = self.get_success_response(self.organization.slug)
        self.check_valid_response(
            resp,
            [
                get_detector(alert_1.uptime_subscription),
                get_detector(alert_2.uptime_subscription),
            ],
        )

    def test_search_by_url(self) -> None:
        self.create_project_uptime_subscription()
        santry_monitor = self.create_project_uptime_subscription(
            uptime_subscription=self.create_uptime_subscription(url="https://santry.com")
        )

        response = self.get_success_response(self.organization.slug, query="santry")
        self.check_valid_response(
            response,
            [
                get_detector(santry_monitor.uptime_subscription),
            ],
        )

    def test_environment_filter(self) -> None:
        env = self.create_environment()
        self.create_project_uptime_subscription()
        env_monitor = self.create_project_uptime_subscription(env=env)

        response = self.get_success_response(self.organization.slug, environment=[env.name])
        self.check_valid_response(
            response,
            [
                get_detector(env_monitor.uptime_subscription),
            ],
        )

    def test_owner_filter(self) -> None:
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
        self.check_valid_response(
            response,
            [
                get_detector(uptime_a.uptime_subscription),
            ],
        )

        # Monitors by users and teams
        response = self.get_success_response(
            self.organization.slug,
            owner=[f"user:{user_1.id}", f"user:{user_2.id}", f"team:{team_1.id}"],
        )
        self.check_valid_response(
            response,
            [
                get_detector(uptime_a.uptime_subscription),
                get_detector(uptime_b.uptime_subscription),
                get_detector(uptime_c.uptime_subscription),
            ],
        )

        # myteams
        response = self.get_success_response(
            self.organization.slug,
            owner=["myteams"],
        )
        self.check_valid_response(
            response,
            [
                get_detector(uptime_d.uptime_subscription),
            ],
        )

        # unassigned monitors
        response = self.get_success_response(
            self.organization.slug,
            owner=["unassigned", f"user:{user_1.id}"],
        )
        self.check_valid_response(
            response,
            [
                get_detector(uptime_a.uptime_subscription),
                get_detector(uptime_e.uptime_subscription),
            ],
        )

        # Invalid user ID
        response = self.get_success_response(
            self.organization.slug,
            owner=["user:12345"],
        )
        self.check_valid_response(response, [])
