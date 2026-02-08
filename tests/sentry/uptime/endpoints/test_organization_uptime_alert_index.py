from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.testutils.helpers import with_feature
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertIndexBaseEndpointTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-index"


@with_feature("organizations:uptime-runtime-assertions")
class OrganizationUptimeAlertIndexEndpointTest(OrganizationUptimeAlertIndexBaseEndpointTest):
    method = "get"

    def check_valid_response(self, response, expected_detectors):
        assert [
            serialize(uptime_alert, serializer=UptimeDetectorSerializer())
            for uptime_alert in expected_detectors
        ] == response.data

    def test(self) -> None:
        alert_1 = self.create_uptime_detector(name="test1")
        alert_2 = self.create_uptime_detector(name="test2")
        resp = self.get_success_response(self.organization.slug)
        self.check_valid_response(resp, [alert_1, alert_2])

    def test_search_by_url(self) -> None:
        self.create_uptime_detector()
        santry_monitor = self.create_uptime_detector(
            uptime_subscription=self.create_uptime_subscription(url="https://santry.com")
        )

        response = self.get_success_response(self.organization.slug, query="santry")
        self.check_valid_response(response, [santry_monitor])

    def test_environment_filter(self) -> None:
        env = self.create_environment()
        self.create_uptime_detector()
        env_detector = self.create_uptime_detector(env=env)

        response = self.get_success_response(self.organization.slug, environment=[env.name])
        self.check_valid_response(response, [env_detector])

    def test_owner_filter(self) -> None:
        user_1 = self.create_user()
        user_2 = self.create_user()
        team_1 = self.create_team()
        team_2 = self.create_team()
        self.create_team_membership(team_2, user=self.user)

        uptime_a = self.create_uptime_detector(owner=user_1)
        uptime_b = self.create_uptime_detector(owner=user_2)
        uptime_c = self.create_uptime_detector(owner=team_1)
        uptime_d = self.create_uptime_detector(owner=team_2)
        uptime_e = self.create_uptime_detector(owner=None)

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

    def test_only_returns_active_detectors(self) -> None:
        active_detector = self.create_uptime_detector(name="active", status=ObjectStatus.ACTIVE)
        self.create_uptime_detector(name="pending_deletion", status=ObjectStatus.PENDING_DELETION)
        self.create_uptime_detector(
            name="deletion_in_progress", status=ObjectStatus.DELETION_IN_PROGRESS
        )

        response = self.get_success_response(self.organization.slug)
        self.check_valid_response(response, [active_detector])
