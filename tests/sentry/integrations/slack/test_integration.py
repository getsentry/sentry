from __future__ import absolute_import

import responses
import six

from django.test.utils import override_settings
from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.slack import SlackIntegrationProvider, SlackIntegration
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase, TestCase
from sentry.testutils.helpers import override_options, with_feature


class SlackIntegrationTest(IntegrationTestCase):
    provider = SlackIntegrationProvider

    def assert_setup_flow(
        self,
        team_id="TXXXXXXX1",
        authorizing_user_id="UXXXXXXX1",
        access_token="xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
        is_wst_app=True,
        expected_client_id="slack-client-id",
        expected_client_secret="slack-client-secret",
    ):
        responses.reset()

        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "slack.com"
        assert redirect.path == "/oauth/authorize" if is_wst_app else "oauth/v2/authorize"
        params = parse_qs(redirect.query)
        scopes = self.provider.wst_oauth_scopes if is_wst_app else self.provider.bot_oauth_scopes
        assert params["scope"] == [" ".join(scopes)]
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == [expected_client_id]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        # XXX(epurkhiser): The slack workspace token app uses oauth.token, the
        # slack bot app uses oauth.v2.access.
        if is_wst_app:
            access_json = {
                "ok": True,
                "access_token": access_token,
                "team_id": team_id,
                "team_name": "Example",
                "authorizing_user_id": authorizing_user_id,
            }
            responses.add(responses.POST, "https://slack.com/api/oauth.token", json=access_json)
        else:
            # TODO: make access token an input
            access_json = {
                "ok": True,
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "team": {"id": team_id, "name": "Example"},
                "authed_user": {"id": authorizing_user_id},
            }
            responses.add(responses.POST, "https://slack.com/api/oauth.v2.access", json=access_json)

        responses.add(
            responses.GET,
            "https://slack.com/api/team.info",
            json={
                "ok": True,
                "team": {
                    "domain": "test-slack-workspace",
                    "icon": {"image_132": "http://example.com/ws_icon.jpg"},
                },
            },
        )

        resp = self.client.get(
            u"{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
        assert req_params["client_id"] == [expected_client_id]
        assert req_params["client_secret"] == [expected_client_secret]

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

    @responses.activate
    def test_bot_flow(self):
        self.assert_setup_flow(
            is_wst_app=False, access_token="xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
        )

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "TXXXXXXX1"
        assert integration.name == "Example"
        assert integration.metadata == {
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "scopes": sorted(self.provider.bot_oauth_scopes),
            "icon": "http://example.com/ws_icon.jpg",
            "domain_name": "test-slack-workspace.slack.com",
            "installation_type": "born_as_bot",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="slack", external_id="TXXXXXXX1")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="UXXXXXXX1")
        assert identity.status == IdentityStatus.VALID

    @override_settings(SLACK_INTEGRATION_USE_WST=True)
    def assert_wst_setup_flow(self, *args, **kwargs):
        self.assert_setup_flow(*args, **kwargs)

    @responses.activate
    @override_settings(SLACK_INTEGRATION_USE_WST=True)
    def test_wst_flow(self):
        self.assert_wst_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "TXXXXXXX1"
        assert integration.name == "Example"
        assert integration.metadata == {
            "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "scopes": sorted(self.provider.wst_oauth_scopes),
            "icon": "http://example.com/ws_icon.jpg",
            "domain_name": "test-slack-workspace.slack.com",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="slack", external_id="TXXXXXXX1")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="UXXXXXXX1")
        assert identity.status == IdentityStatus.VALID

    @responses.activate
    @override_settings(SLACK_INTEGRATION_USE_WST=True)
    def test_multiple_integrations(self):
        self.assert_wst_setup_flow()
        self.assert_wst_setup_flow(team_id="TXXXXXXX2", authorizing_user_id="UXXXXXXX2")

        integrations = Integration.objects.filter(provider=self.provider.key).order_by(
            "external_id"
        )

        assert integrations.count() == 2
        assert integrations[0].external_id == "TXXXXXXX1"
        assert integrations[1].external_id == "TXXXXXXX2"

        oi = OrganizationIntegration.objects.get(
            integration=integrations[1], organization=self.organization
        )
        assert oi.config == {}

        idps = IdentityProvider.objects.filter(type="slack")

        assert idps.count() == 2

        identities = Identity.objects.all()

        assert identities.count() == 2
        assert identities[0].external_id != identities[1].external_id
        assert identities[0].idp != identities[1].idp

    @responses.activate
    @override_settings(SLACK_INTEGRATION_USE_WST=True)
    def test_reassign_user(self):
        self.assert_wst_setup_flow()
        identity = Identity.objects.get()
        assert identity.external_id == "UXXXXXXX1"

        self.assert_wst_setup_flow(authorizing_user_id="UXXXXXXX2")
        identity = Identity.objects.get()
        assert identity.external_id == "UXXXXXXX2"

    @responses.activate
    @with_feature("organizations:slack-v2")
    def test_install_v2(self):
        with override_options(
            {"slack-v2.client-id": "other-id", "slack-v2.client-secret": "other-secret"}
        ):
            self.assert_setup_flow(
                is_wst_app=False,
                access_token="xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                expected_client_id="other-id",
                expected_client_secret="other-secret",
            )


class SlackIntegrationConfigTest(TestCase):
    def setUp(self):
        self.integration = Integration.objects.create(provider="slack", name="Slack", metadata={})
        self.installation = SlackIntegration(self.integration, self.organization.id)

    def test_config_data_workspace_app(self):
        self.installation.get_config_data()["installationType"] = "workspace_app"

    def test_config_data_user_token(self):
        self.integration.metadata["user_access_token"] = "token"
        self.installation.get_config_data()["installationType"] = "classic_bot"

    def test_config_data_born_as_bot(self):
        self.integration.metadata["installation_type"] = "born_as_bot"
        self.installation.get_config_data()["installationType"] = "born_as_bot"
