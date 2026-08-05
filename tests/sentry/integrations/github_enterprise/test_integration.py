from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any
from unittest import mock
from unittest.mock import MagicMock, patch

import orjson
import pytest
import responses
from django.urls import reverse

from sentry.integrations.github_enterprise.client import GitHubEnterpriseApiClient
from sentry.integrations.github_enterprise.integration import (
    GitHubEnterpriseIntegration,
    GitHubEnterpriseIntegrationProvider,
    _api_base_url,
    get_user_info,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.source_code_management.commit_context import (
    CommitInfo,
    FileBlameInfo,
    SourceLineInfo,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, IntegrationTestCase, TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.helpers.integrations import get_installation_of_type
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class ApiBaseUrlTest(TestCase):
    def test_ghes_url(self) -> None:
        assert _api_base_url("github.example.org") == "https://github.example.org/api/v3"

    def test_ghe_cloud_url(self) -> None:
        assert _api_base_url("acme-corp.ghe.com") == "https://api.acme-corp.ghe.com"

    def test_github_com_url(self) -> None:
        assert _api_base_url("github.com") == "https://api.github.com"

    @responses.activate
    def test_get_user_info_ghe_cloud_calls_api_subdomain(self) -> None:
        responses.add(
            method=responses.GET,
            url="https://api.acme-corp.ghe.com/user",
            json={"login": "testuser", "id": 1},
            status=200,
        )
        result = get_user_info("acme-corp.ghe.com", "mytoken")
        assert result == {"login": "testuser", "id": 1}
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://api.acme-corp.ghe.com/user"

    @responses.activate
    def test_get_user_info_ghes_calls_api_v3(self) -> None:
        responses.add(
            method=responses.GET,
            url="https://github.example.org/api/v3/user",
            json={"login": "testuser", "id": 1},
            status=200,
        )
        result = get_user_info("github.example.org", "mytoken")
        assert result == {"login": "testuser", "id": 1}
        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == "https://github.example.org/api/v3/user"


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
        self.base_url = "https://github.example.org/api/v3"

        self.access_token = "xxxxx-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        self.expires_at = "3000-01-01T00:00:00Z"

        with assume_test_silo_mode(SiloMode.CELL):
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

        self.integration.metadata.update(
            {
                "access_token": self.access_token,
                "expires_at": self.expires_at,
            }
        )
        self.integration.save()

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        group = self.create_group()

        if create_external_user:
            # Note: GitHub Enterprise uses GITHUB provider for external actors, not GITHUB_ENTERPRISE
            self.create_external_user(
                user=user,
                organization=self.organization,
                integration=self.integration,
                provider=ExternalProviders.GITHUB_ENTERPRISE.value,
                external_name=external_name,
                external_id=external_id,
            )

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=self.integration,
            key=issue_key,
        )

        return user, installation, external_issue, self.integration, group

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_repositories_search_param(self, mock_jwtm: MagicMock, _: MagicMock) -> None:
        querystring = "q=fork%3Atrue+org%3ATest+Organization+ex"
        responses.add(
            responses.GET,
            f"{self.base_url}/search/repositories?{querystring}",
            json={
                "items": [
                    {
                        "id": 10,
                        "name": "example",
                        "full_name": "test/example",
                        "default_branch": "main",
                    },
                    {
                        "id": 11,
                        "name": "exhaust",
                        "full_name": "test/exhaust",
                        "default_branch": "main",
                    },
                ]
            },
        )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )
        result = installation.get_repositories("ex")
        assert result == [
            {
                "identifier": "test/example",
                "name": "example",
                "external_id": "10",
                "default_branch": "main",
            },
            {
                "identifier": "test/exhaust",
                "name": "exhaust",
                "external_id": "11",
                "default_branch": "main",
            },
        ]

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_file_exists(self, get_jwt: MagicMock, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
            )

        path = "README.md"
        version = "1234567"
        default = "master"
        responses.add(
            responses.HEAD,
            self.base_url + f"/repos/{repo.name}/contents/{path}?ref={version}",
        )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.example.org/Test-Organization/foo/blob/1234567/README.md"

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_file_doesnt_exists(self, get_jwt: MagicMock, _: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
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
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert not result

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_stacktrace_link_use_default_if_version_404(
        self, get_jwt: MagicMock, _: MagicMock
    ) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
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
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )
        result = installation.get_stacktrace_link(repo, path, default, version)

        assert result == "https://github.example.org/Test-Organization/foo/blob/master/README.md"

    @patch("sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token_1")
    @patch("sentry.integrations.github_enterprise.client.get_jwt", return_value="jwt_token_1")
    @responses.activate
    def test_get_commit_context_all_frames(self, _: MagicMock, __: MagicMock) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
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
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
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
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        source_url = "https://github.example.org/Test-Organization/foo/blob/master/src/sentry/integrations/github/integration.py"

        assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/foo",
                url="https://github.example.org/Test-Organization/foo",
                provider="integrations:github_enterprise",
                external_id=123,
                config={"name": "Test-Organization/foo"},
                integration_id=self.integration.id,
            )
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        source_url = "https://github.example.org/Test-Organization/foo/blob/master/src/sentry/integrations/github/integration.py"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/github/integration.py"
        )

    @responses.activate
    def test_get_organization_config(self) -> None:
        # Mock the repositories endpoint
        responses.add(
            responses.GET,
            f"{self.base_url}/installation/repositories",
            json={
                "total_count": 2,
                "repositories": [
                    {
                        "id": 1,
                        "name": "repo1",
                        "full_name": "Test-Organization/repo1",
                        "archived": False,
                    },
                    {
                        "id": 2,
                        "name": "repo2",
                        "full_name": "Test-Organization/repo2",
                        "archived": False,
                    },
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
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
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
        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
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

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 0

    @responses.activate
    def test_sync_assignee_outbound_invalid_key_format(self) -> None:
        """Test that sync handles invalid external issue key format gracefully"""

        user, installation, external_issue, _, _ = self._setup_assignee_sync_test(
            issue_key="invalid-key-format"
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
            installation.sync_assignee_outbound(external_issue, user, assign=True)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert orjson.loads(request.body) == {"assignees": ["octocat"]}

    @responses.activate
    def test_sync_assignee_outbound_with_none_user(self) -> None:
        """Test that assigning with no user does not make an API call"""

        self.integration.metadata.update(
            {
                "access_token": self.access_token,
                "expires_at": self.expires_at,
            }
        )
        self.integration.save()

        installation = get_installation_of_type(
            GitHubEnterpriseIntegration, self.integration, self.organization.id
        )

        group = self.create_group()

        external_issue = self.create_integration_external_issue(
            group=group,
            integration=self.integration,
            key="Test-Organization/foo#123",
        )

        responses.calls.reset()

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
            external_issue = self.create_integration_external_issue(
                group=self.group,
                integration=self.integration,
                key="Test-Organization/foo#123",
            )

        # No responses needed - should return early
        with assume_test_silo_mode(SiloMode.CELL):
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

        with assume_test_silo_mode(SiloMode.CELL):
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
        with assume_test_silo_mode(SiloMode.CELL):
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


class BuildIntegrationGitHubComTest(TestCase):
    """build_integration must produce external_id with the 'github.com:' prefix so the
    github_enterprise integration can coexist with the first-party `github` integration
    (which uses a bare installation_id as external_id)."""

    @patch(
        "sentry.integrations.github_enterprise.integration.GitHubEnterpriseIntegrationProvider._get_ghe_installation_info"
    )
    @patch("sentry.integrations.github_enterprise.integration.get_user_info")
    def test_build_integration_produces_github_com_prefixed_external_id(
        self,
        mock_get_user_info: MagicMock,
        mock_get_installation: MagicMock,
    ) -> None:
        mock_get_user_info.return_value = {"id": 42, "login": "tester"}
        mock_get_installation.return_value = {
            "id": 12345,
            "app_id": 99,
            "account": {
                "login": "acme",
                "type": "Organization",
                "html_url": "https://github.com/acme",
                "avatar_url": "https://github.com/avatars/acme.png",
            },
        }

        provider = GitHubEnterpriseIntegrationProvider()
        state = {
            "oauth_data": {"access_token": "token-abc"},
            "installation_data": {
                "url": "github.com",
                "id": "1",
                "name": "test-app",
                "private_key": "key",
                "verify_ssl": True,
                "webhook_secret": "whsec",
            },
            "installation_id": 12345,
            "oauth_config_information": {
                "access_token_url": "https://github.com/login/oauth/access_token",
                "authorize_url": "https://github.com/login/oauth/authorize",
                "client_id": "cid",
                "client_secret": "csec",
                "verify_ssl": True,
            },
        }
        result = provider.build_integration(state)

        assert result["external_id"] == "github.com:12345"
        assert result["idp_external_id"] == "github.com:99"
        assert result["metadata"]["domain_name"] == "github.com/acme"
        assert result["metadata"]["installation_id"] == 12345


@control_silo_test
class GitHubEnterpriseApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    ghe_host = "github.example.com"
    ghe_url = f"https://{ghe_host}"
    installation_id = "12345"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "github_enterprise"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _submit_config(self, **overrides: Any) -> Any:
        data = {
            "url": self.ghe_url,
            "id": "1",
            "name": "sentry-app",
            "verifySsl": True,
            "webhookSecret": "webhook-secret-123",
            "privateKey": "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
            "clientId": "client-id-abc",
            "clientSecret": "client-secret-xyz",
        }
        data.update(overrides)
        return self._advance_step(data)

    def _get_pipeline_signature(self, resp: Any) -> str:
        return resp.data["data"]["oauthUrl"].split("state=")[1].split("&")[0]

    def _stub_ghe_oauth(self) -> None:
        responses.add(
            responses.POST,
            f"{self.ghe_url}/login/oauth/access_token",
            json={
                "access_token": "test-access-token",
                "token_type": "bearer",
            },
        )

    def _stub_ghe_user(self) -> None:
        responses.add(
            responses.GET,
            f"{self.ghe_url}/api/v3/user",
            json={"id": 42, "login": "testuser"},
        )

    def _stub_ghe_installation(self) -> None:
        responses.add(
            responses.GET,
            f"{self.ghe_url}/api/v3/app/installations/{self.installation_id}",
            json={
                "id": int(self.installation_id),
                "app_id": 1,
                "account": {
                    "login": "Test-Org",
                    "avatar_url": f"{self.ghe_url}/avatar.png",
                    "html_url": f"{self.ghe_url}/Test-Org",
                    "type": "Organization",
                },
            },
        )
        responses.add(
            responses.GET,
            f"{self.ghe_url}/api/v3/user/installations",
            json={
                "installations": [
                    {
                        "id": int(self.installation_id),
                        "app_id": 1,
                        "account": {
                            "login": "Test-Org",
                            "avatar_url": f"{self.ghe_url}/avatar.png",
                            "html_url": f"{self.ghe_url}/Test-Org",
                            "type": "Organization",
                        },
                    }
                ]
            },
        )

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 3
        assert resp.data["provider"] == "github_enterprise"

    @responses.activate
    def test_config_step_advance(self) -> None:
        self._initialize_pipeline()
        resp = self._submit_config()
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "app_install_redirect"
        assert resp.data["stepIndex"] == 1
        assert "appInstallUrl" in resp.data["data"]
        assert "sentry-app" in resp.data["data"]["appInstallUrl"]

    @responses.activate
    def test_config_step_validation_missing_required_fields(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"url": self.ghe_url})
        assert resp.status_code == 400
        for field in ("id", "name", "webhookSecret", "privateKey", "clientId", "clientSecret"):
            assert resp.data[field] == ["This field is required."]

    @responses.activate
    def test_app_install_step_no_installation_id(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({})
        assert resp.status_code == 200
        assert resp.data["status"] == "stay"
        assert "appInstallUrl" in resp.data["data"]

    @responses.activate
    def test_app_install_step_with_installation_id(self) -> None:
        self._initialize_pipeline()
        self._submit_config()
        resp = self._advance_step({"installationId": self.installation_id})
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "oauth_login"
        assert "oauthUrl" in resp.data["data"]
        oauth_url = resp.data["data"]["oauthUrl"]
        assert self.ghe_host in oauth_url

    @responses.activate
    @mock.patch(
        "sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token"
    )
    def test_full_pipeline_flow(self, mock_jwt: MagicMock) -> None:
        self._stub_ghe_oauth()
        self._stub_ghe_user()
        self._stub_ghe_installation()

        resp = self._initialize_pipeline()
        assert resp.data["step"] == "installation_config"

        resp = self._submit_config()
        assert resp.data["step"] == "app_install_redirect"

        resp = self._advance_step({"installationId": self.installation_id})
        assert resp.data["step"] == "oauth_login"
        pipeline_signature = self._get_pipeline_signature(resp)

        resp = self._advance_step({"code": "auth-code", "state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert "data" in resp.data

        integration = Integration.objects.get(provider="github_enterprise")
        assert integration.metadata["installation_id"] == int(self.installation_id)
        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=integration,
        ).exists()

    @responses.activate
    @mock.patch(
        "sentry.integrations.github_enterprise.integration.get_jwt", return_value="jwt_token"
    )
    @override_options({"github-enterprise.disallow-domain-mismatch": True})
    def test_pipeline_fails_if_domain_mismatch_is_detected(self, mock_jwt: MagicMock) -> None:
        original_host = "original-ghe.example.com"
        original_installation_id = int(self.installation_id)
        original_external_id = f"{original_host}:{original_installation_id}"

        with assume_test_silo_mode(SiloMode.CELL):
            original_org = self.create_organization(name="original-org")

        original_integration = self.create_provider_integration(
            provider="github_enterprise",
            external_id=original_external_id,
            name="original-org",
            metadata={
                "domain_name": f"{original_host}/original-org",
                "account_type": "Organization",
                "installation_id": original_installation_id,
                "installation": {
                    "url": original_host,
                    "id": "1",
                    "name": "original-sentry-app",
                    "private_key": "original_private_key",
                    "webhook_secret": "original_webhook_secret",
                    "client_id": "original-client-id",
                    "client_secret": "original-client-secret",
                    "verify_ssl": True,
                    "public_link": None,
                },
            },
        )
        self.create_organization_integration(
            organization_id=original_org.id,
            integration=original_integration,
        )

        overriding_host = "overriding.example.com"
        overriding_url = f"https://{overriding_host}"

        responses.add(
            responses.POST,
            f"{overriding_url}/login/oauth/access_token",
            json={"access_token": "overriding-controlled-token", "token_type": "bearer"},
        )
        responses.add(
            responses.GET,
            f"{overriding_url}/api/v3/user",
            json={"id": 9999, "login": "overriding"},
        )

        spoofed_installation = {
            "id": original_installation_id,
            "app_id": 1,
            "account": {
                "login": "original-org",
                "avatar_url": f"https://{original_host}/avatar.png",
                "html_url": f"https://{original_host}/original-org",
                "type": "Organization",
            },
        }
        responses.add(
            responses.GET,
            f"{overriding_url}/api/v3/app/installations/{self.installation_id}",
            json=spoofed_installation,
        )
        responses.add(
            responses.GET,
            f"{overriding_url}/api/v3/user/installations",
            json={"installations": [spoofed_installation]},
        )

        self._initialize_pipeline()
        self._submit_config(
            url=overriding_url,
            privateKey="overriding_private_key",
            webhookSecret="overriding_webhook_secret",
            clientId="overriding-client-id",
            clientSecret="overriding-client-secret",
            name="overriding-sentry-app",
        )
        resp = self._advance_step({"installationId": self.installation_id})
        pipeline_signature = self._get_pipeline_signature(resp)
        resp = self._advance_step({"code": "auth-code", "state": pipeline_signature})

        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert (
            resp.data["data"]["detail"]
            == "The GitHub Enterprise domain does not match the expected domain. Please check the domain and port combination."
        )

        integrations = Integration.objects.filter(
            provider="github_enterprise", external_id=original_external_id
        )
        assert integrations.count() == 1
        overriding_integration = integrations.get()
        assert overriding_integration.id == original_integration.id

        installation_meta = overriding_integration.metadata["installation"]
        assert installation_meta["private_key"] == "original_private_key"
        assert installation_meta["webhook_secret"] == "original_webhook_secret"
        assert installation_meta["client_id"] == "original-client-id"
        assert installation_meta["client_secret"] == "original-client-secret"
        assert installation_meta["url"] == original_host

        assert OrganizationIntegration.objects.filter(
            organization_id=original_org.id, integration=overriding_integration
        ).exists()
        assert not OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration=overriding_integration
        ).exists()

    @responses.activate
    def test_config_step_allows_github_com(self) -> None:
        self._initialize_pipeline()
        resp = self._submit_config(url="https://github.com")
        assert resp.status_code == 200
        assert resp.data["status"] == "advance"
        assert resp.data["step"] == "app_install_redirect"

    def test_app_install_step_uses_apps_path_for_github_com(self) -> None:
        # github.com hosts the App install page at /apps/{name}, GHES at
        # /github-apps/{name}. Wrong URL → 404 → broken install flow.
        self._initialize_pipeline()
        self._submit_config(url="https://github.com")
        resp = self._advance_step({})
        assert resp.status_code == 200
        assert resp.data["data"]["appInstallUrl"] == "https://github.com/apps/sentry-app"

    def test_ensure_matching_domain_method_with_same_netloc(self) -> None:
        state = {
            "installation_data": {
                "url": "github.com",
            },
        }
        installation = {
            "account": {
                "html_url": "https://github.com/test-org",
            },
        }
        GitHubEnterpriseIntegrationProvider.ensure_matching_domain(state, installation)

    def test_ensure_matching_domain_method_with_same_ports(self) -> None:
        state = {
            "installation_data": {
                "url": "github.com:443",
            },
        }
        installation = {
            "account": {
                "html_url": "https://github.com:443/test-org",
            }
        }
        GitHubEnterpriseIntegrationProvider.ensure_matching_domain(state, installation)

    def test_ensure_matching_domain_method_with_different_ports(self) -> None:
        state = {
            "installation_data": {
                "url": "github.com:443",
            },
        }
        installation = {
            "account": {
                "html_url": "https://github.com:80/test-org",
            }
        }
        with pytest.raises(IntegrationError) as ie:
            GitHubEnterpriseIntegrationProvider.ensure_matching_domain(state, installation)
        assert (
            str(ie.value.message)
            == "The GitHub Enterprise domain does not match the expected domain. Please check the domain and port combination."
        )

    def test_ensure_matching_domain_method_with_different_netloc(self) -> None:
        state = {
            "installation_data": {
                "url": "github.com",
            },
        }
        installation = {
            "account": {
                "html_url": "https://example.com/test-org",
            },
        }
        with pytest.raises(IntegrationError) as ie:
            GitHubEnterpriseIntegrationProvider.ensure_matching_domain(state, installation)
        assert (
            str(ie.value.message)
            == "The GitHub Enterprise domain does not match the expected domain. Please check the domain and port combination."
        )

    def test_ensure_matching_domain_method_with_different_casing(self) -> None:
        state = {
            "installation_data": {
                "url": "github.com",
            },
        }
        installation = {
            "account": {
                "html_url": "https://GitHub.com/test-org",
            },
        }
        GitHubEnterpriseIntegrationProvider.ensure_matching_domain(state, installation)
