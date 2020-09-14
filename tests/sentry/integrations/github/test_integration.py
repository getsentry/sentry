from __future__ import absolute_import

import responses
import sentry

from sentry.utils.compat.mock import MagicMock
from six.moves.urllib.parse import urlencode, urlparse

from sentry.shared_integrations.exceptions import ApiError
from sentry.constants import ObjectStatus
from sentry.integrations.github import GitHubIntegrationProvider, API_ERRORS
from sentry.models import Integration, OrganizationIntegration, Repository, Project
from sentry.plugins.base import plugins
from sentry.testutils import IntegrationTestCase
from tests.sentry.plugins.testutils import register_mock_plugins, unregister_mock_plugins


class GitHubIntegrationTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    def setUp(self):
        super(GitHubIntegrationTest, self).setUp()

        self.installation_id = "install_1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = "3000-01-01T00:00:00Z"

        self._stub_github()
        register_mock_plugins()

    def tearDown(self):
        unregister_mock_plugins()
        super(GitHubIntegrationTest, self).tearDown()

    def _stub_github(self):
        responses.reset()

        sentry.integrations.github.integration.get_jwt = MagicMock(return_value="jwt_token_1")
        sentry.integrations.github.client.get_jwt = MagicMock(return_value="jwt_token_1")

        responses.add(
            responses.POST,
            self.base_url + "/app/installations/{}/access_tokens".format(self.installation_id),
            json={"token": self.access_token, "expires_at": self.expires_at},
        )

        responses.add(
            responses.GET,
            self.base_url + "/installation/repositories",
            json={
                "repositories": [
                    {"id": 1296269, "name": "foo", "full_name": "Test-Organization/foo"},
                    {"id": 9876574, "name": "bar", "full_name": "Test-Organization/bar"},
                ]
            },
        )

        responses.add(
            responses.GET,
            self.base_url + "/app/installations/{}".format(self.installation_id),
            json={
                "id": self.installation_id,
                "app_id": self.app_id,
                "account": {
                    "login": "Test Organization",
                    "avatar_url": "http://example.com/avatar.png",
                    "html_url": "https://github.com/Test-Organization",
                    "type": "Organization",
                },
            },
        )

        responses.add(responses.GET, self.base_url + "/repos/Test-Organization/foo/hooks", json=[])

    def assert_setup_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.com"
        assert redirect.path == "/apps/sentry-test-app"

        # App installation ID is provided
        resp = self.client.get(
            u"{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
        )

        auth_header = responses.calls[0].request.headers["Authorization"]
        assert auth_header == "Bearer jwt_token_1"

        self.assertDialogSuccess(resp)
        return resp

    @responses.activate
    def test_plugin_migration(self):
        accessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="github",
            external_id=123,
            config={"name": "Test-Organization/foo"},
        )

        inaccessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Not-My-Org/other",
            provider="github",
            external_id=321,
            config={"name": "Not-My-Org/other"},
        )

        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        # Updates the existing Repository to belong to the new Integration
        assert Repository.objects.get(id=accessible_repo.id).integration_id == integration.id

        # Doesn't touch Repositories not accessible by the new Integration
        assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None

    @responses.activate
    def test_basic_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == self.installation_id
        assert integration.name == "Test Organization"
        assert integration.metadata == {
            "access_token": None,
            # The metadata doesn't get saved with the timezone "Z" character
            # for some reason, so just compare everything but that.
            "expires_at": None,
            "icon": "http://example.com/avatar.png",
            "domain_name": "github.com/Test-Organization",
            "account_type": "Organization",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

    @responses.activate
    def test_reinstall_flow(self):
        self._stub_github()
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        integration.update(status=ObjectStatus.DISABLED)
        assert integration.status == ObjectStatus.DISABLED
        assert integration.external_id == self.installation_id

        resp = self.client.get(
            u"{}?{}".format(self.init_path, urlencode({"reinstall_id": integration.id}))
        )

        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.com"
        assert redirect.path == "/apps/sentry-test-app"

        # New Installation
        self.installation_id = "install_2"

        self._stub_github()

        resp = self.client.get(
            u"{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
        )

        assert resp.status_code == 200

        auth_header = responses.calls[0].request.headers["Authorization"]
        assert auth_header == "Bearer jwt_token_1"

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.status == ObjectStatus.VISIBLE
        assert integration.external_id == self.installation_id

    @responses.activate
    def test_disable_plugin_when_fully_migrated(self):
        self._stub_github()

        project = Project.objects.create(organization_id=self.organization.id)

        plugin = plugins.get("github")
        plugin.enable(project)

        # Accessible to new Integration - mocked in _stub_github
        Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="github",
            external_id="123",
            config={"name": "Test-Organization/foo"},
        )

        # Enabled before
        assert "github" in [p.slug for p in plugins.for_project(project)]

        with self.tasks():
            self.assert_setup_flow()

        # Disabled after Integration installed
        assert "github" not in [p.slug for p in plugins.for_project(project)]

    @responses.activate
    def test_get_repositories_search_param(self):
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

    @responses.activate
    def test_get_message_from_error(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)
        base_error = "Error Communicating with GitHub (HTTP 404): %s" % (API_ERRORS[404])
        assert (
            installation.message_from_error(
                ApiError("Not Found", code=404, url="https://api.github.com/repos/scefali")
            )
            == base_error
        )
        url = "https://api.github.com/repos/scefali/sentry-integration-example/compare/2adcab794f6f57efa8aa84de68a724e728395792...e208ee2d71e8426522f95efbdae8630fa66499ab"
        assert (
            installation.message_from_error(ApiError("Not Found", code=404, url=url))
            == base_error
            + " Please also confirm that the commits associated with the following URL have been pushed to GitHub: %s"
            % url
        )
