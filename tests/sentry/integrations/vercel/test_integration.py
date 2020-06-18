from __future__ import absolute_import

import responses

from six.moves.urllib.parse import parse_qs, urlencode

from sentry.integrations.vercel import VercelIntegrationProvider
from sentry.models import (
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase


class VercelIntegrationTest(IntegrationTestCase):
    provider = VercelIntegrationProvider

    def assert_setup_flow(self, is_team=False):
        responses.reset()

        access_json = {
            "user_id": "my_user_id",
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
        }

        if is_team:
            team_query = "?teamId=my_team_id"
            access_json["team_id"] = "my_team_id"
            responses.add(
                responses.GET,
                "https://api.vercel.com/v1/teams/my_team_id%s" % team_query,
                json={"name": "my_team_name"},
            )
        else:
            team_query = ""
            responses.add(
                responses.GET,
                "https://api.vercel.com/www/user",
                json={"user": {"name": "my_user_name"}},
            )

        responses.add(
            responses.POST, "https://api.vercel.com/v2/oauth/access_token", json=access_json
        )

        responses.add(
            responses.GET,
            "https://api.vercel.com/v4/projects/%s" % team_query,
            json={"projects": []},
        )

        responses.add(
            responses.POST,
            "https://api.vercel.com/v1/integrations/webhooks%s" % team_query,
            json={"id": "webhook-id"},
        )

        resp = self.client.get(u"{}?{}".format(self.setup_path, urlencode({"code": "oauth-code"}),))

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/vercel/configure/"]
        assert req_params["client_id"] == ["vercel-client-id"]
        assert req_params["client_secret"] == ["vercel-client-secret"]

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

        integration = Integration.objects.get(provider=self.provider.key)

        external_id = "my_team_id" if is_team else "my_user_id"
        name = "my_team_name" if is_team else "my_user_name"
        installation_type = "team" if is_team else "user"

        assert integration.external_id == external_id
        assert integration.name == name
        assert integration.metadata == {
            "access_token": "my_access_token",
            "installation_id": "my_config_id",
            "installation_type": installation_type,
            "webhook_id": "webhook-id",
        }
        assert OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )

    @responses.activate
    def test_team_flow(self):
        self.assert_setup_flow(is_team=True)

    @responses.activate
    def test_user_flow(self):
        self.assert_setup_flow(is_team=False)
