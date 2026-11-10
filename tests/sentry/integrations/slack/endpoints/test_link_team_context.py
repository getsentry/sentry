from datetime import timedelta

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.slack.views import SALT
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test
from sentry.utils.signing import sign


@control_silo_test
class SlackLinkTeamContextTest(APITestCase):
    endpoint = "sentry-api-0-slack-link-team-context"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.integration = self.create_slack_integration(self.organization, external_id="TXXXXXXX1")

    def sign_params(self, **overrides: object) -> str:
        params: dict[str, object] = {
            "integration_id": self.integration.id,
            "slack_id": "UXXXXXXX1",
            "channel_id": "CXXXXXXX1",
            "channel_name": "alerts",
            "response_url": "https://hooks.slack.com/commands/response",
            **overrides,
        }
        return sign(salt=SALT, **params)

    def test_lists_member_organizations_with_the_workspace(self) -> None:
        other_org = self.create_organization(name="Another Org", owner=self.user)
        self.integration.add_organization(other_org)
        self.create_organization(name="No Slack", owner=self.user)
        foreign_org = self.create_organization(name="Not A Member")
        self.integration.add_organization(foreign_org)

        response = self.get_success_response(self.sign_params())

        assert response.data["channelName"] == "alerts"
        assert response.data["channelUrl"] == "slack://channel?team=TXXXXXXX1&id=CXXXXXXX1"
        assert [org["slug"] for org in response.data["organizations"]] == [
            other_org.slug,
            self.organization.slug,
        ]
        assert response.data["organizations"][0]["links"]["regionUrl"]

    def test_omits_organizations_with_a_disabled_installation(self) -> None:
        self.integration.organizationintegration_set.update(status=ObjectStatus.DISABLED)

        response = self.get_success_response(self.sign_params())

        assert response.data["organizations"] == []

    def test_rejects_a_tampered_link(self) -> None:
        response = self.get_error_response(self.sign_params() + "x", status_code=400)

        assert "invalid or has expired" in response.data["detail"]

    def test_rejects_an_expired_link(self) -> None:
        signed_params = self.sign_params()

        with freeze_time(timezone.now() + timedelta(days=3)):
            self.get_error_response(signed_params, status_code=400)

    def test_rejects_a_link_missing_the_channel(self) -> None:
        signed_params = sign(salt=SALT, integration_id=self.integration.id, slack_id="UXXXXXXX1")

        self.get_error_response(signed_params, status_code=400)

    def test_rejects_an_uninstalled_workspace(self) -> None:
        self.integration.update(status=ObjectStatus.DISABLED)

        self.get_error_response(self.sign_params(), status_code=404)

    def test_requires_authentication(self) -> None:
        self.client.logout()

        self.get_error_response(self.sign_params(), status_code=401)
