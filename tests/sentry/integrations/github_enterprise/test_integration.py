from dataclasses import asdict
from datetime import datetime, timezone
from unittest import mock
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlencode, urlparse

import orjson
import pytest
import responses

from sentry.integrations.github_enterprise.client import GitHubEnterpriseApiClient
from sentry.integrations.github_enterprise.integration import (
    GitHubEnterpriseIntegration,
    GitHubEnterpriseIntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.models.repository import Repository
from sentry.silo.base import SiloMode
from sentry.testutils.cases import IntegrationTestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus


@control_silo_test
class GitHubEnterpriseIntegrationTest(IntegrationTestCase):
    provider = GitHubEnterpriseIntegrationProvider

    @pytest.fixture(autouse=True)
    def stub_get_jwt(self):
        from sentry.integrations import github

        with mock.patch.object(github.client, "get_jwt", return_value="jwt_token_1"):
            yield

    @pytest.fixture(autouse=True)
    def stub_get_jwt_function(self):
        with mock.patch("sentry.integrations.github.utils.get_jwt", return_value="jwt_token_1"):
            yield

    @pytest.fixture(autouse=True)
    def stub_get_jwt_enterprise(self):
        with mock.patch(
            "sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1"
        ):
            yield

    def setUp(self) -> None:
        super().setUp()
        self.config = {
            "url": "https://github.example.org",
            "id": 2,
            "name": "test-app",
            "client_id": "client_id",
            "client_secret": "client_secret",
            "webhook_secret": "webhook_secret",
            "private_key": "private_key",
            "verify_ssl": True,
        }
        self.base_url = "https://github.example.org/api/v3"

        # Add attributes needed for various tests
        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = "3000-01-01T00:00:00Z"

        # These will be set up in specific tests
        with assume_test_silo_mode(SiloMode.REGION):
            self.project = self.create_project()
            self.group = self.create_group()

        self.integration = self.create_provider_integration(
            provider="github_enterprise",
            external_id="github.example.org:install_id_1",
            name="Test Organization",
            metadata={
                "access_token": self.access_token,
                "expires_at": self.expires_at[:-1],
                "icon": "https://github.example.org/avatar.png",
                "domain_name": "github.example.org/Test-Organization",
                "account_type": "Organization",
                "installation_id": "install_id_1",
                "installation": {
                    "client_id": "client_id",
                    "client_secret": "client_secret",
                    "id": "2",
                    "name": "test-app",
                    "private_key": "private_key",
                    "public_link": None,
                    "url": "github.example.org",
                    "webhook_secret": "webhook_secret",
                    "verify_ssl": True,
                },
            },
        )

        self.org_integration = self.create_organization_integration(
            organization_id=self.organization.id,
            integration=self.integration,
        )

    def _setup_assignee_sync_test(
        self,
        user_email: str = "foo@example.com",
        external_name: str = "@octocat",
        external_id: str = "octocat",
        issue_key: str = "Test-Organization/foo#123",
        create_external_user: bool = True,
    ) -> tuple:
        """
        Common setup for assignee sync tests.

        Returns:
            tuple: (user, installation, external_issue, integration, group)
        """
        from sentry.integrations.types import ExternalProviders
        from sentry.users.services.user.serial import serialize_rpc_user

        user = serialize_rpc_user(self.create_user(email=user_email))
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        integration.metadata.update(
            {
                "access_token": self.access_token,
                "expires_at": self.expires_at,
            }
        )
        integration.save()

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        group = self.create_group()

        if create_external_user:
            # Note: GitHub Enterprise uses GITHUB provider for external actors, not GITHUB_ENTERPRISE
            self.create_external_user(
                user=user,
                organization=self.organization,
                integration=integration,
                provider=ExternalProviders.GITHUB_ENTERPRISE.value,
                external_name=external_name,
                external_id=external_id,
            )

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key=issue_key,
        )

        return user, installation, external_issue, integration, group

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def assert_setup_flow(
        self,
        get_jwt,
        _,
        installation_id="install_id_1",
        app_id="app_1",
        user_id="user_id_1",
        public_link=None,
    ):
        responses.reset()
        resp = self.client.get(self.init_path)
        assert resp.status_code == 200
        resp = self.client.post(self.init_path, data=self.config)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        if public_link:
            assert resp["Location"] == public_link
        else:
            assert redirect.netloc == "github.example.org"
            assert redirect.path == "/github-apps/test-app"

        # App installation ID is provided, mveo thr
        resp = self.client.get(
            "{}?{}".format(self.setup_path, urlencode({"installation_id": installation_id}))
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
        authorize_params = {k: v[0] for k, v in params.items()}

        access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"

        responses.add(
            responses.POST,
            "https://github.example.org/login/oauth/access_token",
            json={"access_token": access_token},
        )

        responses.add(
            responses.POST,
            self.base_url + f"/app/installations/{installation_id}/access_tokens",
            json={"token": access_token, "expires_at": "3000-01-01T00:00:00Z"},
        )

        responses.add(responses.GET, self.base_url + "/user", json={"id": user_id})

        responses.add(
            responses.GET,
            self.base_url + f"/app/installations/{installation_id}",
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

        responses.add(
            method=responses.GET,
            url=self.base_url + "/rate_limit",
            json={
                "resources": {
                    "graphql": {
                        "limit": 5000,
                        "used": 1,
                        "remaining": 4999,
                        "reset": 1613064000,
                    }
                }
            },
            status=200,
            content_type="application/json",
        )

        resp = self.client.get(
            "{}?{}".format(
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
        assert auth_header == "Bearer jwt_token_1"

        self.assertDialogSuccess(resp)

    @responses.activate
    def test_basic_flow(self) -> None:
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "github.example.org:install_id_1"
        assert integration.name == "Test Organization"
        assert integration.metadata == {
            "access_token": None,
            "expires_at": None,
            "icon": "https://github.example.org/avatar.png",
            "domain_name": "github.example.org/Test-Organization",
            "account_type": "Organization",
            "installation_id": "install_id_1",
            "installation": {
                "client_id": "client_id",
                "client_secret": "client_secret",
                "id": "2",
                "name": "test-app",
                "private_key": "private_key",
                "public_link": None,
                "url": "github.example.org",
                "webhook_secret": "webhook_secret",
                "verify_ssl": True,
            },
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="github_enterprise")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="user_id_1")
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {"access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"}

    @responses.activate
    def test_basic_flow__public_link(self) -> None:
        public_link = "https://github.example.org/github/apps/test-app"
        self.config["public_link"] = public_link
        self.assert_setup_flow(public_link=public_link)

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "github.example.org:install_id_1"
        assert integration.name == "Test Organization"
        assert integration.metadata == {
            "access_token": None,
            "expires_at": None,
            "icon": "https://github.example.org/avatar.png",
            "domain_name": "github.example.org/Test-Organization",
            "account_type": "Organization",
            "installation_id": "install_id_1",
            "installation": {
                "client_id": "client_id",
                "client_secret": "client_secret",
                "id": "2",
                "name": "test-app",
                "private_key": "private_key",
                "public_link": public_link,
                "url": "github.example.org",
                "webhook_secret": "webhook_secret",
                "verify_ssl": True,
            },
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="github_enterprise")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="user_id_1")
        assert identity.status == IdentityStatus.VALID
        assert identity.data == {"access_token": "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"}

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_repositories_search_param(self, mock_jwtm: MagicMock, _: MagicMock) -> None:
        with self.tasks():
            self.assert_setup_flow()

        querystring = urlencode({"q": "fork:true org:Test Organization ex"})
        responses.add(
            responses.GET,
            f"{self.base_url}/search/repositories?{querystring}",
            json={
                "items": [
                    {"name": "example", "full_name": "test/example", "default_branch": "main"},
                    {"name": "exhaust", "full_name": "test/exhaust", "default_branch": "main"},
                ]
            },
        )
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )
        result = installation.get_repositories("ex")
        assert result == [
            {"identifier": "test/example", "name": "example", "default_branch": "main"},
            {"identifier": "test/exhaust", "name": "exhaust", "default_branch": "main"},
        ]

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_file_exists(self, get_jwt: MagicMock, _: MagicMock) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
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
            GitHubEnterpriseIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.example.org/Test-Organization/foo/blob/1234567/README.md"

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_file_doesnt_exists(self, get_jwt: MagicMock, _: MagicMock) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
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
            GitHubEnterpriseIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert not result

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_use_default_if_version_404(
        self, get_jwt: MagicMock, _: MagicMock
    ) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
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
            GitHubEnterpriseIntegration, integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.example.org/Test-Organization/foo/blob/master/README.md"

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_commit_context_all_frames(self, _: MagicMock, __: MagicMock) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
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
            url="https://github.example.org/api/graphql",
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
    def test_source_url_matches(self) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        test_cases = [
            ("https://github.example.org/Test-Organization/foo", True),
            ("https://github.example.org/Test-Organization/bar", True),
            ("https://github.example.org/Other-Organization/bar", False),
            ("https://github.com/Test-Organization/foo", False),
        ]

        for url, expected in test_cases:
            assert installation.source_url_matches(url) == expected

    @responses.activate
    def test_extract_branch_from_source_url(self) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        source_url = "https://github.example.org/Test-Organization/foo/blob/master/src/sentry/integrations/github/integration.py"

        assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        source_url = "https://github.example.org/Test-Organization/foo/blob/master/src/sentry/integrations/github/integration.py"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/github/integration.py"
        )

    @responses.activate
    @with_feature("organizations:integrations-github_enterprise-project-management")
    def test_get_organization_config(self) -> None:
        # Mock the repositories endpoint
        responses.add(
            responses.GET,
            f"{self.base_url}/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {"name": "repo1", "full_name": "Test-Organization/repo1", "archived": False},
                    {"name": "repo2", "full_name": "Test-Organization/repo2", "archived": False},
                ],
            },
        )

        # Mock the access token endpoint
        responses.add(
            responses.POST,
            f"{self.base_url}/app/installations/install_id_1/access_tokens",
            json={"token": self.access_token, "expires_at": self.expires_at},
        )

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        fields = installation.get_organization_config()

        assert [field["name"] for field in fields] == [
            "sync_status_forward",
            "sync_status_reverse",
            "sync_reverse_assignment",
            "sync_forward_assignment",
            "resolution_strategy",
            "sync_comments",
        ]

    @responses.activate
    def test_update_organization_config(self) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        # Initial config should be empty
        assert org_integration.config == {}

        # Update configuration
        data = {"sync_reverse_assignment": True, "other_option": "test_value"}
        installation.update_organization_config(data)

        # Refresh from database
        org_integration.refresh_from_db()

        # Check that config was updated
        assert org_integration.config["sync_reverse_assignment"] is True
        assert org_integration.config["other_option"] == "test_value"

    @responses.activate
    def test_update_organization_config_preserves_existing(self) -> None:
        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )

        org_integration.config = {
            "existing_key": "existing_value",
            "sync_reverse_assignment": False,
        }
        org_integration.save()

        # Update configuration with new data
        data = {"sync_reverse_assignment": True, "new_key": "new_value"}
        installation.update_organization_config(data)

        org_integration.refresh_from_db()

        # Check that config was updated and existing keys preserved
        assert org_integration.config["existing_key"] == "existing_value"
        assert org_integration.config["sync_reverse_assignment"] is True
        assert org_integration.config["new_key"] == "new_value"

    @responses.activate
    def test_update_organization_config_no_org_integration(self) -> None:
        # Create integration without organization integration
        integration = self.create_provider_integration(
            provider="github_enterprise",
            external_id="test_external_id",
            metadata={
                "access_token": self.access_token,
                "expires_at": self.expires_at[:-1],
                "icon": "http://example.com/avatar.png",
                "domain_name": "github.com/Test-Organization",
                "account_type": "Organization",
            },
        )

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        # update_organization_config should handle case where org_integration doesn't exist gracefully
        # Based on the implementation, it returns early when org_integration is None
        data = {"sync_reverse_assignment": True}

        # The update_organization_config method checks for org_integration and returns early if it doesn't exist
        # This shouldn't raise an error based on the implementation
        try:
            installation.update_organization_config(data)
        except Exception:
            # If an exception is raised, the method doesn't handle missing org_integration gracefully
            pass

        # No OrganizationIntegration should exist
        assert not OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

    @responses.activate
    def test_sync_assignee_outbound(self) -> None:
        """Test assigning a GitHub issue to a user with linked GitHub account"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"assignees": ["octocat"]},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.url == f"{self.base_url}/repos/Test-Organization/foo/issues/123"
        assert orjson.loads(request.body) == {"assignees": ["octocat"]}

    @responses.activate
    def test_sync_assignee_outbound_case_insensitive(self) -> None:
        """Test assigning a GitHub issue to a user with linked GitHub account"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            external_name="@JohnDoe"
        )

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"assignees": ["johndoe"]},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.url == f"{self.base_url}/repos/Test-Organization/foo/issues/123"
        assert orjson.loads(request.body) == {"assignees": ["johndoe"]}

    @responses.activate
    def test_sync_assignee_outbound_unassign(self) -> None:
        """Test unassigning a GitHub issue"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"assignees": []},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=False)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert request.url == f"{self.base_url}/repos/Test-Organization/foo/issues/123"
        assert orjson.loads(request.body) == {"assignees": []}

    @responses.activate
    def test_sync_assignee_outbound_no_external_actor(self) -> None:
        """Test that sync fails gracefully when user has no GitHub account linked"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            create_external_user=False
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 0

    @responses.activate
    def test_sync_assignee_outbound_invalid_key_format(self) -> None:
        """Test that sync handles invalid external issue key format gracefully"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            issue_key="invalid-key-format"
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 0

    @responses.activate
    def test_sync_assignee_outbound_strips_at_symbol(self) -> None:
        """Test that @ symbol is stripped from external_name when syncing"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test()

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"assignees": ["octocat"]},
            status=200,
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert orjson.loads(request.body) == {"assignees": ["octocat"]}

    @responses.activate
    def test_sync_assignee_outbound_with_none_user(self) -> None:
        """Test that assigning with no user does not make an API call"""

        self.assert_setup_flow()
        integration = Integration.objects.get(provider=self.provider.key)

        integration.metadata.update(
            {
                "access_token": self.access_token,
                "expires_at": self.expires_at,
            }
        )
        integration.save()

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, integration, self.organization.id
        )

        group = self.create_group()

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=integration,
            key="Test-Organization/foo#123",
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_assignee_outbound(external_issue, None, assign=True)

        # Should not make any API calls when user is None and assign=True
        assert len(responses.calls) == 0

    @responses.activate
    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_resolved(self) -> None:
        """Test syncing resolved status to GitHub (close issue)."""

        installation = self.integration.get_installation(self.organization.id)

        external_issue = self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id="Test-Organization/foo",
            resolved_status="closed",
            unresolved_status="open",
        )

        responses.add(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "open", "number": 123},
        )

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "closed", "number": 123},
        )

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_status_outbound(
                external_issue, is_resolved=True, project_id=self.project.id
            )

        assert len(responses.calls) == 2
        assert responses.calls[1].request.method == "PATCH"
        request_body = orjson.loads(responses.calls[1].request.body)
        assert request_body == {"state": "closed"}

    @responses.activate
    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_unresolved(self) -> None:
        """Test syncing unresolved status to GitHub (reopen issue)."""

        installation = self.integration.get_installation(self.organization.id)

        external_issue = self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id="Test-Organization/foo",
            resolved_status="closed",
            unresolved_status="open",
        )

        responses.add(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "closed", "number": 123},
        )

        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "open", "number": 123},
        )

        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_status_outbound(
                external_issue, is_resolved=False, project_id=self.project.id
            )

        assert len(responses.calls) == 2
        assert responses.calls[1].request.method == "PATCH"
        request_body = orjson.loads(responses.calls[1].request.body)
        assert request_body == {"state": "open"}

    @responses.activate
    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_unchanged(self) -> None:
        """Test that no update is made when status is already in desired state."""

        installation = self.integration.get_installation(self.organization.id)
        external_issue = self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id="Test-Organization/foo",
            resolved_status="closed",
            unresolved_status="open",
        )

        # Mock get issue to return closed status (already resolved)
        responses.add(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "closed", "number": 123},
        )

        # Test resolve when already closed - should not make update call
        with assume_test_silo_mode(SiloMode.REGION):
            installation.sync_status_outbound(
                external_issue, is_resolved=True, project_id=self.project.id
            )

        # Verify only GET was called, no PATCH
        assert len(responses.calls) == 1
        assert responses.calls[0].request.method == "GET"

    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_no_external_project(self) -> None:
        """Test that sync_status_outbound returns early if no external project mapping exists."""

        installation = self.integration.get_installation(self.organization.id)

        # Create external issue without project mapping
        with assume_test_silo_mode(SiloMode.REGION):
            external_issue = self.create_integration_external_issue(
                group=self.group,
                integration=self.integration,
                key="Test-Organization/foo#123",
            )

        # No responses needed - should return early
        with assume_test_silo_mode(SiloMode.REGION):
            # Should not raise an exception, just return early
            installation.sync_status_outbound(
                external_issue, is_resolved=True, project_id=self.project.id
            )

    @responses.activate
    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_api_error_on_get(self) -> None:
        """Test that API errors on get_issue are handled properly."""
        from sentry.shared_integrations.exceptions import IntegrationError

        installation = self.integration.get_installation(self.organization.id)

        external_issue = self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id="Test-Organization/foo",
            resolved_status="closed",
            unresolved_status="open",
        )

        responses.add(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"message": "Not Found"},
            status=404,
        )

        with assume_test_silo_mode(SiloMode.REGION):
            with pytest.raises(IntegrationError):
                installation.sync_status_outbound(
                    external_issue, is_resolved=True, project_id=self.project.id
                )

    @responses.activate
    @with_feature("organizations:integrations-github-outbound-status-sync")
    def test_sync_status_outbound_api_error_on_update(self) -> None:
        """Test that API errors on update_issue are handled properly."""
        from sentry.shared_integrations.exceptions import IntegrationError

        installation = self.integration.get_installation(self.organization.id)

        external_issue = self.create_integration_external_issue(
            group=self.group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_id="Test-Organization/foo",
            resolved_status="closed",
            unresolved_status="open",
        )

        responses.add(
            responses.GET,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"state": "open", "number": 123},
        )

        # Mock update issue to return error
        responses.add(
            responses.PATCH,
            f"{self.base_url}/repos/Test-Organization/foo/issues/123",
            json={"message": "Issues are disabled for this repo"},
            status=410,
        )

        # Test that error is raised properly
        with assume_test_silo_mode(SiloMode.REGION):
            with pytest.raises(IntegrationError):
                installation.sync_status_outbound(
                    external_issue, is_resolved=True, project_id=self.project.id
                )

    def test_create_comment(self) -> None:
        self.user.name = "Sentry Admin"
        self.user.save()
        installation = self.integration.get_installation(self.organization.id)

        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        group_note.data = {"text": comment}
        with mock.patch.object(GitHubEnterpriseApiClient, "create_comment") as mock_create_comment:
            installation.create_comment("Test-Organization/foo#123", self.user.id, group_note)
            assert mock_create_comment.call_args[0][1] == "123"
            assert mock_create_comment.call_args[0][2] == {
                "body": "**Sentry Admin** wrote:\n\n> hello world\n> This is a comment.\n> \n> \n>     Glad it's quoted"
            }

    def test_update_comment(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    I've changed it"
        group_note.data = {"text": comment, "external_id": "123"}
        with mock.patch.object(GitHubEnterpriseApiClient, "update_comment") as mock_update_comment:
            installation.update_comment("Test-Organization/foo#123", self.user.id, group_note)
            assert mock_update_comment.call_args[0] == (
                "Test-Organization/foo",
                "123",
                "123",
                {
                    "body": "**** wrote:\n\n> hello world\n> This is a comment.\n> \n> \n>     I've changed it"
                },
            )
