from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any
from unittest import mock
from unittest.mock import patch
from urllib.parse import urlencode, urlparse

import orjson
import pytest
import responses
from django.urls import reverse

import sentry
from fixtures.github import INSTALLATION_EVENT_EXAMPLE
from sentry.constants import ObjectStatus
from sentry.integrations.github import client
from sentry.integrations.github.client import MINIMUM_REQUESTS
from sentry.integrations.github.integration import (
    API_ERRORS,
    GitHubInstallationError,
    GitHubIntegration,
    GitHubIntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.integrations.source_code_management.repo_trees import RepoAndBranch, RepoTree
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.organizations.absolute_url import generate_organization_url
from sentry.plugins.base import plugins
from sentry.plugins.bases.issue2 import IssueTrackingPlugin2
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_failure_metric
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils.cache import cache

TREE_RESPONSES = {
    "xyz": {"status_code": 200, "body": {"tree": [{"path": "src/xyz.py", "type": "blob"}]}},
    "foo": {
        "status_code": 200,
        "body": {
            # The latest sha for a specific branch
            "sha": "a4e587563cb5dbb46192b5962cbadc8c532a8455",
            "tree": [
                {
                    "path": ".artifacts",
                    "mode": "040000",
                    "type": "tree",  # A directory
                    "sha": "44813f92a105143eff565d14d2054c2ea90eb62e",
                    "url": "https://api.github.com/repos/Test-Organization/foo/git/trees/44813f92a105143eff565d14d2054c2ea90eb62e",
                },
                {
                    "path": "src/sentry/api/endpoints/auth_login.py",
                    "mode": "100644",
                    "type": "blob",  # A file
                    "sha": "517899e22ada047336cab4ecbbf8c27b151f190c",
                    "size": 2711,
                    "url": "https://api.github.com/repos/Test-Organization/foo/git/blobs/517899e22ada047336cab4ecbbf8c27b151f190c",
                },
            ],
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


class GitHubPlugin(IssueTrackingPlugin2):
    slug = "github"
    name = "GitHub Mock Plugin"
    conf_key = slug


@control_silo_test
class GitHubIntegrationTest(IntegrationTestCase):
    provider = GitHubIntegrationProvider
    base_url = "https://api.github.com"

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

    @pytest.fixture(autouse=True)
    def stub_get_jwt(self):
        with mock.patch.object(client, "get_jwt", return_value="jwt_token_1"):
            yield

    def _stub_github(self):
        """This stubs the calls related to a Github App"""
        self.gh_org = "Test-Organization"
        pp = 1

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        responses.add(
            responses.POST,
            "https://github.com/login/oauth/access_token",
            body=f"access_token={access_token}",
        )

        responses.add(responses.GET, self.base_url + "/user", json={"login": "octocat"})

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )

        repositories: dict[str, Any] = {
            "xyz": {
                "name": "xyz",
                "full_name": "Test-Organization/xyz",
                "default_branch": "master",
            },
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
            "archived": {
                "archived": True,
            },
        }
        self.repositories = repositories
        len_repos = len(repositories)
        api_url = f"{self.base_url}/installation/repositories"
        first = f'<{api_url}?per_page={pp}&page=1>; rel="first"'
        last = f'<{api_url}?per_page={pp}&page={len_repos}>; rel="last"'

        def gen_link(page: int, text: str) -> str:
            return f'<{api_url}?per_page={pp}&page={page}>; rel="{text}"'

        responses.add(
            responses.GET,
            url=api_url,
            match=[responses.matchers.query_param_matcher({"per_page": pp})],
            json={"total_count": len_repos, "repositories": [repositories["foo"]]},
            headers={"link": ", ".join([gen_link(2, "next"), last])},
        )
        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            match=[responses.matchers.query_param_matcher({"per_page": pp, "page": 2})],
            json={"total_count": len_repos, "repositories": [repositories["bar"]]},
            headers={"link": ", ".join([gen_link(1, "prev"), gen_link(3, "next"), last, first])},
        )
        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            match=[responses.matchers.query_param_matcher({"per_page": pp, "page": 3})],
            json={"total_count": len_repos, "repositories": [repositories["baz"]]},
            headers={"link": ", ".join([gen_link(2, "prev"), first])},
        )
        # This is for when we're not testing the pagination logic
        responses.add(
            responses.GET,
            url=self.base_url + "/installation/repositories",
            match=[responses.matchers.query_param_matcher({"per_page": 100})],
            json={
                "total_count": len(repositories),
                "repositories": [repo for repo in repositories.values()],
            },
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
        assert redirect.path == "/login/oauth/authorize"
        assert (
            redirect.query
            == "client_id=github-client-id&state=9cae5e88803f35ed7970fc131e6e65d3&redirect_uri=http://testserver/extensions/github/setup/"
        )

        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode(
                    {"code": "12345678901234567890", "state": "9cae5e88803f35ed7970fc131e6e65d3"}
                ),
            )
        )
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "github.com"
        assert redirect.path == "/apps/sentry-test-app"

        # App installation ID is provided
        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
        )

        auth_header = responses.calls[2].request.headers["Authorization"]
        assert auth_header == "Bearer jwt_token_1"

        self.assertDialogSuccess(resp)
        return resp

    @responses.activate
    def test_plugin_migration(self):
        with assume_test_silo_mode(SiloMode.REGION):
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

        with assume_test_silo_mode(SiloMode.REGION):
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
            "access_token": self.access_token,
            # The metadata doesn't get saved with the timezone "Z" character
            "expires_at": self.expires_at[:-1],
            "icon": "http://example.com/avatar.png",
            "domain_name": "github.com/Test-Organization",
            "account_type": "Organization",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_github_installed_on_another_org(self, mock_record):
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
        self.setup_path_2 = "{}?{}".format(
            self.setup_path,
            urlencode(
                {"code": "12345678901234567890", "state": "9cae5e88803f35ed7970fc131e6e65d3"}
            ),
        )
        mock_record.reset_mock()
        with self.feature({"system:multi-region": True}):
            resp = self.client.get(self.init_path_2)
            resp = self.client.get(self.setup_path_2)
            self.assertTemplateUsed(resp, "sentry/integrations/github-integration-failed.html")
            assert (
                b'{"success":false,"data":{"error":"Github installed on another Sentry organization."}}'
                in resp.content
            )
            assert (
                b"It seems that your GitHub account has been installed on another Sentry organization. Please uninstall and try again."
                in resp.content
            )
            assert b'window.opener.postMessage({"success":false' in resp.content
            assert (
                f', "{generate_organization_url(self.organization_2.slug)}");'.encode()
                in resp.content
            )
            assert_failure_metric(mock_record, GitHubInstallationError.INSTALLATION_EXISTS)

        # Delete the Integration
        integration = Integration.objects.get(external_id=self.installation_id)
        for oi in OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration=integration
        ):
            oi.delete()
        integration.delete()

        # Try again and should be successful
        resp = self.client.get(self.init_path_2)
        resp = self.client.get(self.setup_path_2)

        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(external_id=self.installation_id)
        assert integration.provider == "github"
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization_2.id, integration=integration
        ).exists()

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_installation_not_found(self, mock_record):
        # Add a 404 for an org to responses
        responses.replace(
            responses.GET, self.base_url + f"/app/installations/{self.installation_id}", status=404
        )
        # Attempt to install integration
        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"installation_id": self.installation_id}))
        )
        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode(
                    {"code": "12345678901234567890", "state": "ddd023d87a913d5226e2a882c4c4cc05"}
                ),
            )
        )
        assert b"Invalid state" in resp.content
        assert_failure_metric(mock_record, GitHubInstallationError.INVALID_STATE)

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    @override_options({"github-app.webhook-secret": ""})
    def test_github_user_mismatch(self, mock_record):
        self._stub_github()

        # Emulate GitHub installation
        init_path_1 = "{}?{}".format(
            reverse(
                "sentry-organization-integrations-setup",
                kwargs={
                    "organization_slug": self.organization.slug,
                    "provider_id": self.provider.key,
                },
            ),
            urlencode({"installation_id": self.installation_id}),
        )
        self.client.get(init_path_1)

        webhook_event = orjson.loads(INSTALLATION_EVENT_EXAMPLE)
        webhook_event["installation"]["id"] = self.installation_id
        webhook_event["sender"]["login"] = "attacker"
        resp = self.client.post(
            path="/extensions/github/webhook/",
            data=orjson.dumps(webhook_event),
            content_type="application/json",
            HTTP_X_GITHUB_EVENT="installation",
            HTTP_X_HUB_SIGNATURE="sha1=d184e6717f8bfbcc291ebc8c0756ee446c6c9486",
            HTTP_X_GITHUB_DELIVERY="00000000-0000-4000-8000-1234567890ab",
        )
        assert resp.status_code == 204

        # Validate the installation user
        user_2 = self.create_user("foo@example.com")
        org_2 = self.create_organization(name="Rowdy Tiger", owner=user_2)
        self.login_as(user_2)
        init_path_2 = "{}?{}".format(
            reverse(
                "sentry-organization-integrations-setup",
                kwargs={
                    "organization_slug": org_2.slug,
                    "provider_id": self.provider.key,
                },
            ),
            urlencode({"installation_id": self.installation_id}),
        )
        setup_path_2 = "{}?{}".format(
            self.setup_path,
            urlencode(
                {"code": "12345678901234567890", "state": "9cae5e88803f35ed7970fc131e6e65d3"}
            ),
        )
        with self.feature({"system:multi-region": True}):
            resp = self.client.get(init_path_2)
            resp = self.client.get(setup_path_2)
            self.assertTemplateUsed(resp, "sentry/integrations/github-integration-failed.html")
            assert resp.status_code == 200
            assert b'window.opener.postMessage({"success":false' in resp.content
            assert b"Authenticated user is not the same as who installed the app" in resp.content
            assert_failure_metric(mock_record, GitHubInstallationError.USER_MISMATCH)

    @responses.activate
    def test_disable_plugin_when_fully_migrated(self):
        self._stub_github()

        with assume_test_silo_mode(SiloMode.REGION):
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
                    {"name": "example", "full_name": "test/example", "default_branch": "master"},
                    {"name": "exhaust", "full_name": "test/exhaust", "default_branch": "master"},
                ]
            },
        )
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        # This searches for any repositories matching the term 'ex'
        result = installation.get_repositories("ex")
        assert result == [
            {"identifier": "test/example", "name": "example", "default_branch": "master"},
            {"identifier": "test/exhaust", "name": "exhaust", "default_branch": "master"},
        ]

    @responses.activate
    def test_get_repositories_all_and_pagination(self):
        """Fetch all repositories and test the pagination logic."""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )

        with patch.object(sentry.integrations.github.client.GitHubBaseClient, "page_size", 1):
            result = installation.get_repositories()
            assert result == [
                {"name": "foo", "identifier": "Test-Organization/foo", "default_branch": "master"},
                {"name": "bar", "identifier": "Test-Organization/bar", "default_branch": "main"},
                {"name": "baz", "identifier": "Test-Organization/baz", "default_branch": "master"},
            ]

    @responses.activate
    def test_get_repositories_only_first_page(self):
        """Fetch all repositories and test the pagination logic."""
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )

        with (
            patch.object(
                sentry.integrations.github.client.GitHubBaseClient, "page_number_limit", 1
            ),
            patch.object(sentry.integrations.github.client.GitHubBaseClient, "page_size", 1),
        ):
            result = installation.get_repositories()
            assert result == [
                {"name": "foo", "identifier": "Test-Organization/foo", "default_branch": "master"},
            ]

    @responses.activate
    def test_get_stacktrace_link_file_exists(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
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
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.com/Test-Organization/foo/blob/1234567/README.md"

    @responses.activate
    def test_get_stacktrace_link_file_doesnt_exists(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
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
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert not result

    @responses.activate
    def test_get_stacktrace_link_no_org_integration(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
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
        OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        ).delete()
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert not result

    @responses.activate
    def test_get_stacktrace_link_use_default_if_version_404(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
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
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.com/Test-Organization/foo/blob/master/README.md"

    @responses.activate
    def test_get_message_from_error(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
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
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_github_prevent_install_until_pending_deletion_is_complete(self, mock_record):
        self._stub_github()
        # First installation should be successful
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        # set installation to pending deletion
        oi.status = ObjectStatus.PENDING_DELETION
        oi.save()

        # New Installation
        self.installation_id = "install_2"

        self._stub_github()

        mock_record.reset_mock()
        with self.feature({"system:multi-region": True}):
            resp = self.client.get(
                "{}?{}".format(self.init_path, urlencode({"installation_id": self.installation_id}))
            )
            resp = self.client.get(
                "{}?{}".format(
                    self.setup_path,
                    urlencode(
                        {
                            "code": "12345678901234567890",
                            "state": "9cae5e88803f35ed7970fc131e6e65d3",
                        }
                    ),
                )
            )

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/github-integration-failed.html")

        assert b'window.opener.postMessage({"success":false' in resp.content
        assert f', "{generate_organization_url(self.organization.slug)}");'.encode() in resp.content

        # Assert payload returned to main window
        assert (
            b'{"success":false,"data":{"error":"GitHub installation pending deletion."}}'
            in resp.content
        )

        assert_failure_metric(mock_record, GitHubInstallationError.PENDING_DELETION)

        # Delete the original Integration
        oi.delete()
        integration.delete()

        # Try again and should be successful
        resp = self.client.get(
            "{}?{}".format(self.init_path, urlencode({"installation_id": self.installation_id}))
        )
        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode(
                    {"code": "12345678901234567890", "state": "9cae5e88803f35ed7970fc131e6e65d3"}
                ),
            )
        )
        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(external_id=self.installation_id)
        assert integration.provider == "github"
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration=integration
        ).exists()

    def set_rate_limit(
        self, remaining=MINIMUM_REQUESTS + 100, limit=5000, json_body=None, status=200
    ):
        """Helper class to set the rate limit.
        A status code different than 200 requires a json_body
        """
        response_json = (
            json_body
            if status != 200
            else {
                "resources": {
                    "core": {"limit": limit, "remaining": remaining, "used": "foo", "reset": 123},
                    "graphql": {
                        "limit": limit,
                        "remaining": remaining,
                        "used": "foo",
                        "reset": 123,
                    },
                }
            }
        )
        # upsert: it calls add() if not existant, otherwise, it calls replace
        responses.upsert(
            responses.GET, "https://api.github.com/rate_limit", json=response_json, status=status
        )

    def get_installation_helper(self) -> GitHubIntegration:
        with self.tasks():
            self.assert_setup_flow()  # This somehow creates the integration

        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )
        return installation

    def _expected_trees(self, repo_info_list=None):
        result = {}
        # bar and baz are defined to fail, thus, do not show up in the default case
        list = repo_info_list or [
            ("xyz", "master", ["src/xyz.py"]),
            ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
        ]
        for repo, branch, files in list:
            result[f"{self.gh_org}/{repo}"] = RepoTree(
                RepoAndBranch(f"{self.gh_org}/{repo}", branch), files
            )
        return result

    def _expected_cached_repos(self):
        return [
            {"full_name": f"{self.gh_org}/xyz", "default_branch": "master"},
            {"full_name": f"{self.gh_org}/foo", "default_branch": "master"},
            {"full_name": f"{self.gh_org}/bar", "default_branch": "main"},
            {"full_name": f"{self.gh_org}/baz", "default_branch": "master"},
        ]

    @responses.activate
    def test_get_trees_for_org_works(self):
        """Fetch the tree representation of a repo"""
        installation = self.get_installation_helper()
        cache.clear()
        self.set_rate_limit()
        expected_trees = self._expected_trees()
        repos_key = f"githubtrees:repositories:{self.organization.id}"
        repo_key = lambda x: f"github:repo:Test-Organization/{x}:source-code"
        # Check that the cache is clear
        assert cache.get(repos_key) is None
        assert cache.get(repo_key("foo")) is None

        trees = installation.get_trees_for_org()

        assert cache.get(repos_key) == self._expected_cached_repos()
        assert cache.get(repo_key("foo")) == ["src/sentry/api/endpoints/auth_login.py"]
        assert trees == expected_trees

        # Calling a second time should produce the same results
        trees = installation.get_trees_for_org()
        assert trees == expected_trees

    @responses.activate
    def test_get_trees_for_org_prevent_exhaustion_some_repos(self):
        """Some repos will hit the network but the rest will grab from the cache."""
        repos_key = f"githubtrees:repositories:{self.organization.id}"
        cache.clear()
        installation = self.get_installation_helper()
        expected_trees = self._expected_trees(
            [
                ("xyz", "master", ["src/xyz.py"]),
                # foo will have no files because we will hit the minimum remaining requests floor
                ("foo", "master", []),
                ("bar", "main", []),
                ("baz", "master", []),
            ]
        )

        with patch(
            "sentry.integrations.source_code_management.repo_trees.MINIMUM_REQUESTS_REMAINING",
            new=5,
            autospec=False,
        ):
            # We start with one request left before reaching the minimum remaining requests floor
            self.set_rate_limit(remaining=6)
            assert cache.get(repos_key) is None
            trees = installation.get_trees_for_org()

            assert trees == expected_trees
            assert cache.get(repos_key) == self._expected_cached_repos()

            # Another call should not make us loose the files for xyz
            self.set_rate_limit(remaining=5)
            trees = installation.get_trees_for_org()
            assert trees == expected_trees  # xyz will have files but not foo

            # We reset the remaining values
            self.set_rate_limit(remaining=20)
            trees = installation.get_trees_for_org()
            assert trees == self._expected_trees(
                [
                    ("xyz", "master", ["src/xyz.py"]),
                    # Now that the rate limit is reset we should get files for foo
                    ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
                ]
            )

    @responses.activate
    def test_get_trees_for_org_rate_limit_401(self):
        """Sometimes the rate limit API fails from the get go."""
        # Generic test set up
        cache.clear()  # TODO: Investigate why it did not work in the setUp method
        installation = self.get_installation_helper()

        # None of the repos will have any files since rate limit will fail
        # with a 401 response (which makes no sense)
        self.set_rate_limit(json_body={"message": "Bad credentials"}, status=401)
        trees = installation.get_trees_for_org()
        assert trees == self._expected_trees(
            [
                ("xyz", "master", []),
                ("foo", "master", []),
                ("bar", "main", []),
                ("baz", "master", []),
            ]
        )

        # This time the rate limit will not fail, thus, it will fetch the trees
        self.set_rate_limit()
        trees = installation.get_trees_for_org()
        assert trees == self._expected_trees(
            [
                ("xyz", "master", ["src/xyz.py"]),
                ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
            ]
        )

        # This time we will get a 401 but be will load from the cache (unlike the first time)
        self.set_rate_limit(json_body={"message": "Bad credentials"}, status=401)
        trees = installation.get_trees_for_org()
        assert trees == self._expected_trees(
            [
                ("xyz", "master", ["src/xyz.py"]),
                ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
                ("bar", "main", []),
                ("baz", "master", []),
            ]
        )

    @responses.activate
    def test_get_trees_for_org_makes_API_requests_before_MAX_CONNECTION_ERRORS_is_hit(self):
        """
        If some requests fail, but `MAX_CONNECTION_ERRORS` isn't hit, requests will continue
        to be made to the API.
        """
        installation = self.get_installation_helper()
        self.set_rate_limit()

        # Given that below we mock MAX_CONNECTION_ERRORS to be 2, the error we hit here
        # should NOT force the remaining repos to pull from the cache.
        responses.replace(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/xyz/git/trees/master?recursive=1",
            body=ApiError("Server Error"),
        )

        # Clear the cache so we can tell when we're pulling from it rather than from an
        # API call
        cache.clear()

        with patch(
            "sentry.integrations.source_code_management.repo_trees.MAX_CONNECTION_ERRORS",
            new=2,
        ):

            trees = installation.get_trees_for_org()
            assert trees == self._expected_trees(
                [
                    # xyz is missing because its request errors
                    # foo has data because its API request is made in spite of xyz's error
                    ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
                    # bar and baz are missing because their API requests throw errors for
                    # other reasons in the default mock responses
                ]
            )

    @responses.activate
    def test_get_trees_for_org_falls_back_to_cache_once_MAX_CONNECTION_ERRORS_is_hit(self):
        """Once `MAX_CONNECTION_ERRORS` requests fail, the rest will grab from the cache."""
        installation = self.get_installation_helper()
        self.set_rate_limit()

        # Given that below we mock MAX_CONNECTION_ERRORS to be 1, the error we hit here
        # should force the remaining repos to pull from the cache.
        responses.replace(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/xyz/git/trees/master?recursive=1",
            body=ApiError("Server Error"),
        )

        # Clear the cache so we can tell when we're pulling from it rather than from an
        # API call
        cache.clear()

        with patch(
            "sentry.integrations.source_code_management.repo_trees.MAX_CONNECTION_ERRORS",
            new=1,
        ):

            trees = installation.get_trees_for_org()
            assert trees == self._expected_trees(
                [
                    # xyz isn't here because the request errors out.
                    # foo, bar, and baz are here but have no files, because xyz's error
                    # caused us to pull from the empty cache
                    ("foo", "master", []),
                    ("bar", "main", []),
                    ("baz", "master", []),
                ]
            )

    @responses.activate
    def test_get_commit_context_all_frames(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.com/Test-Organization/foo",
                provider="github",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=integration.id,
            )

        self.set_rate_limit()
        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )

        file = SourceLineInfo(
            path="src/github.py",
            lineno=10,
            ref="master",
            repo=repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        responses.add(
            responses.POST,
            url="https://api.github.com/graphql",
            json={
                "data": {
                    "repository0": {
                        "ref0": {
                            "target": {
                                "blame0": {
                                    "ranges": [
                                        {
                                            "commit": {
                                                "oid": "123",
                                                "author": {
                                                    "name": "Foo",
                                                    "email": "foo@example.com",
                                                },
                                                "message": "hello",
                                                "committedDate": "2023-01-01T00:00:00Z",
                                            },
                                            "startingLine": 10,
                                            "endingLine": 15,
                                            "age": 0,
                                        },
                                    ]
                                },
                            }
                        }
                    }
                }
            },
            content_type="application/json",
            status=200,
        )

        response = installation.get_commit_context_all_frames([file], extra={})

        assert response == [
            FileBlameInfo(
                **asdict(file),
                commit=CommitInfo(
                    commitId="123",
                    commitMessage="hello",
                    committedDate=datetime(2023, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                    commitAuthorEmail="foo@example.com",
                    commitAuthorName="Foo",
                ),
            )
        ]

    @responses.activate
    def test_source_url_matches(self):
        installation = self.get_installation_helper()

        test_cases = [
            (
                "https://github.com/Test-Organization/sentry/blob/master/src/sentry/integrations/github/integration.py",
                True,
            ),
            (
                "https://notgithub.com/Test-Organization/sentry/blob/master/src/sentry/integrations/github/integration.py",
                False,
            ),
            ("https://jianyuan.io", False),
        ]
        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    @responses.activate
    def test_extract_branch_from_source_url(self):
        installation = self.get_installation_helper()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://github.com/Test-Organization/repo",
                provider="integrations:github",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://github.com/Test-Organization/repo/blob/master/src/sentry/integrations/github/integration.py"

        assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self):
        installation = self.get_installation_helper()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://github.com/Test-Organization/repo",
                provider="integrations:github",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://github.com/Test-Organization/repo/blob/master/src/sentry/integrations/github/integration.py"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/github/integration.py"
        )

    @responses.activate
    def test_get_stacktrace_link_with_special_chars(self):
        """Test that URLs with special characters (like square brackets) are properly encoded"""
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.com/Test-Organization/foo",
                provider="integrations:github",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=integration.id,
            )

        installation = get_installation_of_type(
            GitHubIntegration, integration, self.organization.id
        )

        filepath = "src/components/[id]/test.py"
        branch = "master"
        responses.add(
            responses.HEAD,
            f"{self.base_url}/repos/{repo.name}/contents/{filepath}?ref={branch}",
        )
        source_url = installation.get_stacktrace_link(repo, filepath, branch, branch)
        assert (
            source_url
            == "https://github.com/Test-Organization/foo/blob/master/src/components/%5Bid%5D/test.py"
        )
