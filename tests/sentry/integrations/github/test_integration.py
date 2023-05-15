from unittest.mock import MagicMock, patch
from urllib.parse import urlencode, urlparse

import responses
from django.urls import reverse

import sentry
from sentry.api.utils import generate_organization_url
from sentry.constants import ObjectStatus
from sentry.integrations.github import API_ERRORS, MINIMUM_REQUESTS, GitHubIntegrationProvider
from sentry.integrations.utils.code_mapping import Repo, RepoTree
from sentry.models import Integration, OrganizationIntegration, Project, Repository
from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils import IntegrationTestCase
from sentry.testutils.silo import control_silo_test
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

    def _stub_github(self):
        """This stubs the calls related to a Github App"""
        self.gh_org = "Test-Organization"
        sentry.integrations.github.integration.get_jwt = MagicMock(return_value="jwt_token_1")
        sentry.integrations.github.client.get_jwt = MagicMock(return_value="jwt_token_1")
        pp = 1

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{self.installation_id}/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )

        repositories = {
            "xyz": {
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
            integration=integration, organization_id=self.organization.id
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
        with self.feature({"organizations:customer-domains": [self.organization_2.slug]}):
            resp = self.client.get(self.init_path_2)
            self.assertTemplateUsed(
                resp, "sentry/integrations/github-integration-exists-on-another-org.html"
            )
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

        # Delete the Integration
        integration = Integration.objects.get(external_id=self.installation_id)
        for oi in OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration=integration
        ):
            oi.delete()
        integration.delete()

        # Try again and should be successful
        resp = self.client.get(self.init_path_2)
        self.assertDialogSuccess(resp)
        integration = Integration.objects.get(external_id=self.installation_id)
        assert integration.provider == "github"
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization_2.id, integration=integration
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
        assert integration.status == ObjectStatus.ACTIVE
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
                    {"name": "example", "full_name": "test/example", "default_branch": "master"},
                    {"name": "exhaust", "full_name": "test/exhaust", "default_branch": "master"},
                ]
            },
        )
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
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
        installation = integration.get_installation(self.organization.id)

        with patch.object(sentry.integrations.github.client.GitHubClientMixin, "page_size", 1):
            result = installation.get_repositories(fetch_max_pages=True)
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
        installation = integration.get_installation(self.organization.id)

        with patch.object(sentry.integrations.github.client.GitHubClientMixin, "page_size", 1):
            result = installation.get_repositories()
            assert result == [
                {"name": "foo", "identifier": "Test-Organization/foo", "default_branch": "master"},
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
        installation = integration.get_installation(self.organization.id)
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
        installation = integration.get_installation(self.organization.id)
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
        installation = integration.get_installation(self.organization.id)
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.com/Test-Organization/foo/blob/master/README.md"

    @responses.activate
    def test_get_message_from_error(self):
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
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
            integration=integration, organization_id=self.organization.id
        )
        # set installation to pending deletion
        oi.status = ObjectStatus.PENDING_DELETION
        oi.save()

        # New Installation
        self.installation_id = "install_2"

        self._stub_github()

        with self.feature({"organizations:customer-domains": [self.organization.slug]}):
            resp = self.client.get(
                "{}?{}".format(self.init_path, urlencode({"installation_id": self.installation_id}))
            )

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/integrations/integration-pending-deletion.html")

        assert b'window.opener.postMessage({"success":false' in resp.content
        assert f', "{generate_organization_url(self.organization.slug)}");'.encode() in resp.content

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
                    "core": {"limit": limit, "remaining": remaining, "used": "foo", "reset": 123}
                }
            }
        )
        # upsert: it calls add() if not existant, otherwise, it calls replace
        responses.upsert(
            responses.GET, "https://api.github.com/rate_limit", json=response_json, status=status
        )

    def get_installation_helper(self):
        with self.tasks():
            self.assert_setup_flow()  # This somehow creates the integration

        integration = Integration.objects.get(provider=self.provider.key)
        installation = integration.get_installation(self.organization.id)
        return installation

    def _expected_trees(self, repo_info_list=None):
        result = {}
        # bar and baz are defined to fail, thus, do not show up in the default case
        list = repo_info_list or [
            ("xyz", "master", ["src/xyz.py"]),
            ("foo", "master", ["src/sentry/api/endpoints/auth_login.py"]),
        ]
        for repo, branch, files in list:
            result[f"{self.gh_org}/{repo}"] = RepoTree(Repo(f"{self.gh_org}/{repo}", branch), files)
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
        repos_key = "githubtrees:repositories:Test-Organization"
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
        repos_key = "githubtrees:repositories:Test-Organization"
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

        with patch("sentry.integrations.github.client.MINIMUM_REQUESTS", new=5, autospec=False):
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
            "sentry.integrations.github.client.MAX_CONNECTION_ERRORS",
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
            "sentry.integrations.github.client.MAX_CONNECTION_ERRORS",
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
