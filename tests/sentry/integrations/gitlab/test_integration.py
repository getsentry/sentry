from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse
from sentry.utils.compat.mock import patch, Mock

from sentry.integrations.gitlab import GitlabIntegrationProvider
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase


class GitlabIntegrationTest(IntegrationTestCase):
    provider = GitlabIntegrationProvider
    config = {
        # Trailing slash is intentional to ensure that valid
        # URLs are generated even if the user inputs a trailing /
        "url": "https://gitlab.example.com/",
        "name": "Test App",
        "group": "cool-group",
        "verify_ssl": True,
        "client_id": "client_id",
        "client_secret": "client_secret",
        "include_subgroups": True,
    }

    default_group_id = 4

    def setUp(self):
        super(GitlabIntegrationTest, self).setUp()
        self.init_path_without_guide = "%s%s" % (self.init_path, "?completed_installation_guide")

    def assert_setup_flow(self, user_id="user_id_1"):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "you will need to create a Sentry app in your GitLab instance")
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "gitlab.example.com"
        assert redirect.path == "/oauth/authorize"

        params = parse_qs(redirect.query)
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == ["client_id"]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

        responses.add(
            responses.POST,
            "https://gitlab.example.com/oauth/token",
            json={"access_token": access_token},
        )
        responses.add(responses.GET, "https://gitlab.example.com/api/v4/user", json={"id": user_id})
        responses.add(
            responses.GET,
            "https://gitlab.example.com/api/v4/groups/cool-group",
            json={
                "id": self.default_group_id,
                "full_name": "Cool",
                "full_path": "cool-group",
                "web_url": "https://gitlab.example.com/groups/cool-group",
                "avatar_url": "https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
            },
        )
        responses.add(
            responses.POST, "https://gitlab.example.com/api/v4/hooks", json={"id": "webhook-id-1"}
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
        assert req_params["redirect_uri"] == ["http://testserver/extensions/gitlab/setup/"]
        assert req_params["client_id"] == ["client_id"]
        assert req_params["client_secret"] == ["client_secret"]

        assert resp.status_code == 200

        self.assertDialogSuccess(resp)

    @responses.activate
    @patch("sentry.integrations.gitlab.integration.sha1_text")
    def test_basic_flow(self, mock_sha):
        sha = Mock()
        sha.hexdigest.return_value = "secret-token"
        mock_sha.return_value = sha

        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "gitlab.example.com:4"
        assert integration.name == "Cool"
        assert integration.metadata == {
            "instance": "gitlab.example.com",
            "scopes": ["api"],
            "icon": u"https://gitlab.example.com/uploads/group/avatar/4/foo.jpg",
            "domain_name": u"gitlab.example.com/cool-group",
            "verify_ssl": True,
            "base_url": "https://gitlab.example.com",
            "webhook_secret": "secret-token",
            "group_id": self.default_group_id,
            "include_subgroups": True,
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="gitlab")
        identity = Identity.objects.get(
            idp=idp, user=self.user, external_id="gitlab.example.com:user_id_1"
        )
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {"access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"}

    def test_goback_to_instructions(self):
        # Go to instructions
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

        # Go to setup form
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200
        self.assertContains(resp, "Step 2")

        # Go to back to instructions
        resp = self.client.get(self.init_path + "?goback=1")
        assert resp.status_code == 200
        self.assertContains(resp, "Step 1")

    @responses.activate
    def test_setup_missing_group(self):
        resp = self.client.get(self.init_path_without_guide)
        assert resp.status_code == 200

        resp = self.client.post(self.init_path_without_guide, data=self.config)
        assert resp.status_code == 302

        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "gitlab.example.com"
        assert redirect.path == "/oauth/authorize"

        params = parse_qs(redirect.query)
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        responses.add(
            responses.POST,
            "https://gitlab.example.com/oauth/token",
            json={"access_token": "access-token-value"},
        )
        responses.add(responses.GET, "https://gitlab.example.com/api/v4/user", json={"id": 9})
        responses.add(
            responses.GET, "https://gitlab.example.com/api/v4/groups/cool-group", status=404
        )
        resp = self.client.get(
            u"{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )
        assert resp.status_code == 200
        self.assertContains(resp, "GitLab group could not be found")

    @responses.activate
    def test_get_group_id(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        installation = integration.get_installation(self.organization.id)
        assert self.default_group_id == installation.get_group_id()
