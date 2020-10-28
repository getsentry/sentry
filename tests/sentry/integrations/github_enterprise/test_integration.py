from __future__ import absolute_import

import responses
import six
from sentry.utils.compat.mock import patch
from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.github_enterprise import GitHubEnterpriseIntegrationProvider
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase


class GitHubEnterpriseIntegrationTest(IntegrationTestCase):
    provider = GitHubEnterpriseIntegrationProvider
    config = {
        "url": "https://github.example.org",
        "id": 2,
        "name": "test-app",
        "client_id": "client_id",
        "client_secret": "client_secret",
        "webhook_secret": "webhook_secret",
        "private_key": "private_key",
        "verify_ssl": True,
    }
    base_url = "https://github.example.org/api/v3"

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value=b"jwt_token_1")
    @patch("sentry.integrations.github.client.get_jwt", return_value=b"jwt_token_1")
    def assert_setup_flow(
        self, get_jwt, _, installation_id="install_id_1", app_id="app_1", user_id="user_id_1"
    ):
        responses.reset()
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.example.org"
        assert redirect.path == "/github-apps/test-app"

        # App installation ID is provided, mveo thr
        resp = self.client.get(
            u"{}?{}".format(self.setup_path, urlencode({"installation_id": installation_id}))
        )

        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.example.org"
        assert redirect.path == "/login/oauth/authorize"

        params = parse_qs(redirect.query)
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/github-enterprise/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == ["client_id"]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

        responses.add(
            responses.POST,
            "https://github.example.org/login/oauth/access_token",
            json={"access_token": access_token},
        )

        responses.add(
            responses.POST,
            self.base_url + "/app/installations/{}/access_tokens".format(installation_id),
            json={"token": access_token, "expires_at": "3000-01-01T00:00:00Z"},
        )

        responses.add(responses.GET, self.base_url + "/user", json={"id": user_id})

        responses.add(
            responses.GET,
            self.base_url + "/app/installations/{}".format(installation_id),
            json={
                "id": installation_id,
                "app_id": app_id,
                "account": {
                    "login": "Test Organization",
                    "type": "Organization",
                    "avatar_url": "https://github.example.org/avatar.png",
                    "html_url": "https://github.example.org/Test-Organization",
                },
            },
        )

        responses.add(
            responses.GET,
            self.base_url + "/user/installations",
            json={"installations": [{"id": installation_id}]},
        )

        resp = self.client.get(
            u"{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        mock_access_token_request = responses.calls[0].request
        req_params = parse_qs(mock_access_token_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == [
            "http://testserver/extensions/github-enterprise/setup/"
        ]
        assert req_params["client_id"] == ["client_id"]
        assert req_params["client_secret"] == ["client_secret"]

        assert resp.status_code == 200

        auth_header = responses.calls[2].request.headers["Authorization"]
        assert auth_header == b"Bearer jwt_token_1"

        self.assertDialogSuccess(resp)

    @responses.activate
    def test_basic_flow(self):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "github.example.org:install_id_1"
        assert integration.name == "Test Organization"
        assert integration.metadata == {
            u"access_token": None,
            u"expires_at": None,
            u"icon": u"https://github.example.org/avatar.png",
            u"domain_name": u"github.example.org/Test-Organization",
            u"account_type": u"Organization",
            u"installation_id": u"install_id_1",
            u"installation": {
                u"client_id": u"client_id",
                u"client_secret": u"client_secret",
                u"id": u"2",
                u"name": u"test-app",
                u"private_key": u"private_key",
                u"url": u"github.example.org",
                u"webhook_secret": u"webhook_secret",
                u"verify_ssl": True,
            },
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="github_enterprise")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="user_id_1")
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {"access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"}

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value=b"jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value=b"jwt_token_1")
    @responses.activate
    def test_get_repositories_search_param(self, mock_jwtm, _):
        with self.tasks():
            self.assert_setup_flow()

        responses.add(
            responses.GET,
            self.base_url + "/search/repositories?q=org:test%20ex",
            json={
                "items": [
                    {"name": "example", "full_name": "test/example"},
                    {"name": "exhaust", "full_name": "test/exhaust"},
                ]
            },
        )
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)
        result = installation.get_repositories("ex")
        assert result == [
            {"identifier": "test/example", "name": "example"},
            {"identifier": "test/exhaust", "name": "exhaust"},
        ]
