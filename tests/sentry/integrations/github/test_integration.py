import os
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode, urlparse

import pytest
import responses
from django.urls import reverse

import sentry
from sentry.constants import ObjectStatus
from sentry.integrations.github import API_ERRORS, GitHubIntegrationProvider
from sentry.integrations.utils.code_mapping import CodeMapping, CodeMappingTreesHelper, Repo
from sentry.models import Integration, OrganizationIntegration, Project, Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils import IntegrationTestCase
from sentry.utils import json

TREE_RESPONSES = {
    "foo": {
        "status_code": 200,
        "body": {
            # The latest sha for a specific branch
            "sha": "a4e587563cb5dbb46192b5962cbadc8c532a8455",
            "tree": [],
            "url": "https://api.github.com/repos/Test-Organization/foo/git/trees/a4e587563cb5dbb46192b5962cbadc8c532a8455",
            "truncated": False,  # If this is True, we have reached the limit of what we can get with the recursive option
        },
    },
    "bar": {
        "status_code": 409,
        "body": {"message": "Git Repository is empty."},
    },
    "baz": {
        "status_code": 404,
        "body": {"message": "Not Found"},
    },
}

with open(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures/sentry_tree.json")
) as fd:
    sentry_tree = json.load(fd)

# The tree responses have a lot more fields but this is the minimum required
for path in sentry_tree:
    TREE_RESPONSES["foo"]["body"]["tree"].append({"type": "blob", "path": path})


class GitHubPlugin(IssueTrackingPlugin2):
    slug = "github"
    name = "GitHub Mock Plugin"
    conf_key = slug


class GitHubIntegrationTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

    @pytest.fixture(autouse=True)
    def inject_fixtures(self, caplog):
        self._caplog = caplog

    def setUp(self):
        super().setUp()

        self.installation_id = "install_1"
        self.user_id = "user_1"
        self.app_id = "app_1"
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = "3000-01-01T00:00:00Z"

        self._stub_github()
        plugins.register(GitHubPlugin)

    def tearDown(self):
        responses.reset()
        plugins.unregister(GitHubPlugin)
        super().tearDown()

    def _stub_github(self):
        """This stubs the calls related to a Github App"""
        sentry.integrations.github.integration.get_jwt = MagicMock(return_value="jwt_token_1")
        sentry.integrations.github.client.get_jwt = MagicMock(return_value="jwt_token_1")
        pp = 1

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )

        repositories = {
            "foo": {
                "id": 1296269,
                "name": "foo",
                "full_name": "Test-Organization/foo",
                "default_branch": "master",
            },
            "bar": {
                "id": 9876574,
                "name": "bar",
                "full_name": "Test-Organization/bar",
                "default_branch": "main",
            },
            "baz": {
                "id": 1276555,
                "name": "baz",
                "full_name": "Test-Organization/baz",
                "default_branch": "master",
            },
        }
        api_url = f"{self.base_url}/installation/repositories"
        first = f'<{api_url}?per_page={pp}&page=1>; rel="first"'
        last = f'<{api_url}?per_page={pp}&page={len(repositories)}>; rel="last"'

        def gen_link(page: int, text: str) -> str:
            return f'<{api_url}?per_page={pp}&page={page}>; rel="{text}"'

        responses.add(
            responses.GET,
            url=api_url,
            match=[responses.matchers.query_param_matcher({"per_page": pp})],
            json={"repositories": [repositories["foo"]]},
            headers={"link": ", ".join([gen_link(2, "next"), last])},
        )
        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            match=[responses.matchers.query_param_matcher({"per_page": pp, "page": 2})],
            json={"repositories": [repositories["bar"]]},
            headers={"link": ", ".join([gen_link(1, "prev"), gen_link(3, "next"), last, first])},
        )
        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            match=[responses.matchers.query_param_matcher({"per_page": pp, "page": 3})],
            json={"repositories": [repositories["baz"]]},
            headers={"link": ", ".join([gen_link(2, "prev"), first])},
        )

        responses.add(
            responses.GET,
            self.base_url + f"/app/installations/{self.installation_id}",
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

        # Logic to get a tree for a repo
        # https://api.github.com/repos/getsentry/sentry/git/trees/master?recursive=1
        for repo_name, values in TREE_RESPONSES.items():
            responses.add(
                responses.GET,
                f"{self.base_url}/repos/Test-Organization/{repo_name}/git/trees/{repositories[repo_name]['default_branch']}?recursive=1",
                json=values["body"],
                status=values["status_code"],
            )

    def assert_setup_flow(self):
        resp = self.client.get(self.init_path)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.com"
        assert redirect.path == "/apps/sentry-test-app"

        # App installation ID is provided
        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
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
    def test_github_installed_on_another_org(self):
        self._stub_github()
        # First installation should be successful
        self.assert_setup_flow()

        # Second installation attempt for same Github account should fail
        self.organization_2 = self.create_organization(name="petal", owner=self.user)
        # Use the same Github installation_id
        self.init_path_2 = "{}?{}".format(
            reverse(
                "sentry-organization-integrations-setup",
                kwargs={
                    "organization_slug": self.organization_2.slug,
                    "provider_id": self.provider.key,
                },
            ),
            urlencode({"installation_id": self.installation_id}),
        )
        resp = self.client.get(self.init_path_2)
        assert (
            b'{"success":false,"data":{"error":"Github installed on another Sentry organization."}}'
            in resp.content
        )
        assert (
            b"It seems that your GitHub account has been installed on another Sentry organization. Please uninstall and try again."
            in resp.content
        )

        # Delete the Integration
        integration = Integration.objects.get(external_id=self.installation_id)
        OrganizationIntegration.objects.filter(
            organization=self.organization, integration=integration
        ).delete()
        integration.delete()

        # Try again and should be successful
        resp = self.client.get(self.init_path_2)
        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(external_id=self.installation_id)
        assert integration.provider == "github"
        assert OrganizationIntegration.objects.filter(
            organization=self.organization_2, integration=integration
        ).exists()

    @responses.activate
    def test_installation_not_found(self):
        # Add a 404 for an org to responses
        responses.replace(
            responses.GET, self.base_url + f"/app/installations/{self.installation_id}", status=404
        )
        # Attempt to install integration
        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
        )
        assert b"The GitHub installation could not be found." in resp.content

    @responses.activate
    def test_reinstall_flow(self):
        self._stub_github()
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        integration.update(status=ObjectStatus.DISABLED)
        assert integration.status == ObjectStatus.DISABLED
        assert integration.external_id == self.installation_id

        resp = self.client.get(
            "{}?{}".format(self.init_path, urlencode({"reinstall_id": integration.id}))
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
            "{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
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

        querystring = urlencode({"q": "org:Test Organization ex"})
        responses.add(
            responses.GET,
            f"{self.base_url}/search/repositories?{querystring}",
            json={
                "items": [
                    {"name": "example", "full_name": "test/example"},
                    {"name": "exhaust", "full_name": "test/exhaust"},
                ]
            },
        )
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)
        # This searches for any repositories matching the term 'ex'
        result = installation.get_repositories("ex")
        assert result == [
            {"identifier": "test/example", "name": "example"},
            {"identifier": "test/exhaust", "name": "exhaust"},
        ]

    @responses.activate
    def test_get_repositories_all_and_pagination(self):
        """Fetch all repositories and test the pagination logic."""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)

        with patch.object(sentry.integrations.github.client.GitHubClientMixin, "page_size", 1):
            result = installation.get_repositories(fetch_max_pages=True)
            assert result == [
                {"name": "foo", "identifier": "Test-Organization/foo"},
                {"name": "bar", "identifier": "Test-Organization/bar"},
                {"name": "baz", "identifier": "Test-Organization/baz"},
            ]

    @responses.activate
    def test_get_repositories_only_first_page(self):
        """Fetch all repositories and test the pagination logic."""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)

        with patch.object(sentry.integrations.github.client.GitHubClientMixin, "page_size", 1):
            result = installation.get_repositories()
            assert result == [
                {"name": "foo", "identifier": "Test-Organization/foo"},
            ]

    @responses.activate
    def test_get_stacktrace_link_file_exists(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            config={"name": "Test-Organization/foo"},
            integration_id=integration.id,
        )

        path = "README.md"
        version = "1234567"
        default = "master"
        responses.add(
            responses.HEAD,
            self.base_url + f"/repos/{repo.name}/contents/{path}?ref={version}",
        )
        installation = integration.get_installation(self.organization)
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.com/Test-Organization/foo/blob/1234567/README.md"

    @responses.activate
    def test_get_stacktrace_link_file_doesnt_exists(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            config={"name": "Test-Organization/foo"},
            integration_id=integration.id,
        )
        path = "README.md"
        version = "master"
        default = "master"
        responses.add(
            responses.HEAD,
            self.base_url + f"/repos/{repo.name}/contents/{path}?ref={version}",
            status=404,
        )
        installation = integration.get_installation(self.organization)
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert not result

    @responses.activate
    def test_get_stacktrace_link_use_default_if_version_404(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="Test-Organization/foo",
            url="https://github.com/Test-Organization/foo",
            provider="integrations:github",
            external_id=123,
            config={"name": "Test-Organization/foo"},
            integration_id=integration.id,
        )
        path = "README.md"
        version = "12345678"
        default = "master"
        responses.add(
            responses.HEAD,
            self.base_url + f"/repos/{repo.name}/contents/{path}?ref={version}",
            status=404,
        )
        responses.add(
            responses.HEAD,
            self.base_url + f"/repos/{repo.name}/contents/{path}?ref={default}",
        )
        installation = integration.get_installation(self.organization)
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.com/Test-Organization/foo/blob/master/README.md"

    @responses.activate
    def test_get_message_from_error(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)
        base_error = f"Error Communicating with GitHub (HTTP 404): {API_ERRORS[404]}"
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
            + f" Please also confirm that the commits associated with the following URL have been pushed to GitHub: {url}"
        )

    @responses.activate
    def test_github_prevent_install_until_pending_deletion_is_complete(self):
        self._stub_github()
        # First installation should be successful
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        # set installation to pending deletion
        oi.status = ObjectStatus.PENDING_DELETION
        oi.save()

        # New Installation
        self.installation_id = "install_2"

        self._stub_github()

        resp = self.client.get(
            "{}?{}".format(self.init_path, urlencode({"installation_id": self.installation_id}))
        )

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/integration-pending-deletion.html")

        # Assert payload returned to main window
        assert (
            b'{"success":false,"data":{"error":"GitHub installation pending deletion."}}'
            in resp.content
        )

        # Delete the original Integration
        oi.delete()
        integration.delete()

        # Try again and should be successful
        resp = self.client.get(
            "{}?{}".format(self.init_path, urlencode({"installation_id": self.installation_id}))
        )
        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(external_id=self.installation_id)
        assert integration.provider == "github"
        assert OrganizationIntegration.objects.filter(
            organization=self.organization, integration=integration
        ).exists()

    @responses.activate
    def test_derive_code_mappings(self):
        """Fetch the tree representation of a repo"""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization)
        with patch.object(sentry.integrations.github.client.GitHubClientMixin, "page_size", 1):
            trees = installation.get_client().get_trees_for_org(self.organization.slug)
            # This check is useful since it will be available in the GCP logs
            assert (
                self._caplog.records[0].message
                == "The Github App does not have access to Test-Organization/baz."
            )
            assert self._caplog.records[0].levelname == "ERROR"

        trees_helper = CodeMappingTreesHelper(trees)

        expected_code_mappings = [
            CodeMapping(
                Repo("Test-Organization/foo", "master"),
                "sentry",
                "src/sentry",
            ),
            CodeMapping(
                Repo("Test-Organization/foo", "master"),
                "sentry_plugins",
                "src/sentry_plugins",
            ),
        ]

        # Case 1 - No matches
        stacktraces = [
            "getsentry/billing/tax/manager.py",
            "requests/models.py",
            "urllib3/connectionpool.py",
            "ssl.py",
        ]
        code_mappings = trees_helper.generate_code_mappings(stacktraces)
        assert code_mappings == []

        # Case 2 - Failing to derive sentry_plugins since we match more than one file
        stacktraces = [
            # More than one file matches for this, thus, no stack traces will be produced
            # - "src/sentry_plugins/slack/client.py",
            # - "src/sentry/integrations/slack/client.py",
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = trees_helper.generate_code_mappings(stacktraces)
        assert code_mappings == []

        # Case 3 - We derive sentry_plugins because we derive sentry first
        stacktraces = [
            "sentry/identity/oauth2.py",
            # This file matches two files in the repo, however, because we first
            # derive the sentry code mapping we can exclude one of the files
            "sentry_plugins/slack/client.py",
        ]
        code_mappings = trees_helper.generate_code_mappings(stacktraces)
        assert code_mappings == expected_code_mappings

        # Case 4 - We do *not* derive sentry_plugins because we don't derive sentry first
        stacktraces = [
            # This file matches two files in the repo and because we process it
            # before we derive
            "sentry_plugins/slack/client.py",
            "sentry/identity/oauth2.py",
        ]
        code_mappings = trees_helper.generate_code_mappings(stacktraces)
        # The reprocess feature allows determinging the sentry_plugins code mappings
        assert code_mappings == expected_code_mappings
