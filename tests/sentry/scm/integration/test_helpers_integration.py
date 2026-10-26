from unittest.mock import MagicMock, patch

import pytest
from scm.errors import GitProviderNotSupported
from scm.providers.cursor_origin.provider import CursorOriginProvider
from scm.providers.github.provider import GitHubProvider
from scm.types import ProviderName, Repository

from sentry.constants import ObjectStatus
from sentry.hybridcloud.rpc.service import RpcRemoteException, RpcResponseException
from sentry.integrations.services.integration import integration_service
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.helpers import (
    fetch_access_token,
    fetch_repository,
    fetch_service_provider,
    make_fetchers,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test

TOKEN = "ghs_installation_token"
# Far enough ahead that the GitHub client never refreshes the token over the network.
TOKEN_EXPIRES_AT = "3000-01-01T00:00:00"


class TestFetchRepository(TestCase):
    def test_fetch_by_id_returns_repository(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["name"] == "test-org/test-repo"
        assert result["organization_id"] == self.organization.id
        assert result["is_active"] is True

    def test_fetch_by_id_returns_none_for_nonexistent(self) -> None:
        assert fetch_repository(self.organization.id, 99999) is None

    def test_fetch_by_id_returns_none_for_wrong_organization(self) -> None:
        other_org = self.create_organization()
        repo = RepositoryModel.objects.create(
            organization_id=other_org.id,
            name="other-org/other-repo",
            provider="integrations:github",
            external_id="67890",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )
        assert fetch_repository(self.organization.id, repo.id) is None

    def test_fetch_by_provider_and_external_id_returns_repository(self) -> None:
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )

        result = fetch_repository(self.organization.id, ("github", "12345"))

        assert result is not None
        assert result["name"] == "test-org/test-repo"

    def test_fetch_by_provider_and_name_returns_repository(self) -> None:
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="99999",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )

        result = fetch_repository(self.organization.id, ("github", "test-org/test-repo"))

        assert result is not None
        assert result["name"] == "test-org/test-repo"

    def test_fetch_by_provider_and_external_id_returns_none_for_nonexistent(self) -> None:
        assert fetch_repository(self.organization.id, ("github", "nonexistent")) is None

    def test_fetch_ghe_repo_populates_web_base_url(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GHE Acme",
            external_id="ghe-acme-1",
            metadata={
                "domain_name": "github.acme.com/installations/1",
                "installation_id": "1",
                "installation": {"id": "1", "private_key": "x", "verify_ssl": True},
            },
        )
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="acme/widget",
            provider="integrations:github_enterprise",
            external_id="9001",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = fetch_repository(self.organization.id, ("github_enterprise", "9001"))

        assert result is not None
        assert result["provider_name"] == "github_enterprise"
        assert result["web_base_url"] == "https://github.acme.com"

    def test_fetch_ghe_cloud_repo_populates_web_base_url(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GHE Cloud Acme",
            external_id="ghe-cloud-acme-1",
            metadata={
                "domain_name": "acme-corp.ghe.com",
                "installation_id": "2",
                "installation": {"id": "2", "private_key": "x", "verify_ssl": True},
            },
        )
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="acme/widget",
            provider="integrations:github_enterprise",
            external_id="9002",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = fetch_repository(self.organization.id, ("github_enterprise", "9002"))

        assert result is not None
        assert result["web_base_url"] == "https://acme-corp.ghe.com"

    def _create_gitlab_repo(self, instance: str, metadata: dict[str, str]) -> RepositoryModel:
        integration = self.create_integration(
            organization=self.organization,
            provider="gitlab",
            name="GitLab Acme",
            external_id=f"{instance}:acme",
            metadata=metadata,
        )
        return self.create_repo(
            project=self.project,
            name="acme / widget",
            provider="integrations:gitlab",
            external_id=f"{instance}:42",
            integration_id=integration.id,
        )

    def test_fetch_gitlab_repo_populates_web_base_url(self) -> None:
        repo = self._create_gitlab_repo(
            "gitlab.com",
            {
                "instance": "gitlab.com",
                "domain_name": "gitlab.com/acme",
                "base_url": "https://gitlab.com",
            },
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["provider_name"] == "gitlab"
        assert result["web_base_url"] == "https://gitlab.com"

    def test_fetch_self_hosted_gitlab_repo_keeps_path_prefix(self) -> None:
        repo = self._create_gitlab_repo(
            "git.acme.com",
            {
                "instance": "git.acme.com",
                "domain_name": "git.acme.com/acme",
                "base_url": "https://git.acme.com/gitlab/",
            },
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["web_base_url"] == "https://git.acme.com/gitlab"

    def test_fetch_gitlab_repo_without_base_url_web_base_url_is_none(self) -> None:
        repo = self._create_gitlab_repo(
            "git.acme.com",
            {"instance": "git.acme.com", "domain_name": "git.acme.com/acme"},
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["web_base_url"] is None

    def test_fetch_non_ghe_repo_web_base_url_is_none(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="11111",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["web_base_url"] is None
        assert result["installation_id"] is None

    def test_fetch_cursor_origin_repo_populates_installation_id(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id="inst_01example",
        )
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="acme/rocket",
            provider="integrations:cursor_origin",
            external_id="r_01example",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = fetch_repository(self.organization.id, ("cursor_origin", "r_01example"))

        assert result is not None
        assert result["installation_id"] == "inst_01example"

    def test_fetch_gitlab_repo_populates_path_from_config(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="GitLab.org / GitLab FOSS",
            provider="integrations:gitlab",
            external_id="gitlab.example.com:13083",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
            config={"path": "gitlab-org/gitlab-foss", "project_id": 13083},
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        # Sentry's pinned sentry-scm may predate the `path` key, so read it untyped.
        assert dict(result)["path"] == "gitlab-org/gitlab-foss"

    def test_fetch_gitlab_repo_without_config_path_has_none_path(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="GitLab.org / GitLab FOSS",
            provider="integrations:gitlab",
            external_id="gitlab.example.com:13083",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert dict(result)["path"] is None

    def test_fetch_non_gitlab_repo_has_no_path(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="22222",
            status=ObjectStatus.ACTIVE,
            integration_id=1,
            config={"path": "test-org/test-repo"},
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert "path" not in result


class TestFetchServiceProvider(TestCase):
    def test_returns_provider_from_map_to_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )

        repository: Repository = {
            "id": 1,
            "integration_id": integration.id,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": None,
            "provider_name": "github",
            "web_base_url": None,
            "installation_id": None,
        }
        provider = fetch_service_provider(
            self.organization.id,
            repository,
        )

        assert isinstance(provider, GitHubProvider)

    def test_returns_none_for_nonexistent_integration(self) -> None:
        repository: Repository = {
            "id": 1,
            "integration_id": 99999,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": None,
            "provider_name": "github",
            "web_base_url": None,
            "installation_id": None,
        }
        result = fetch_service_provider(self.organization.id, repository)
        assert result is None

    def test_github_enterprise_returns_github_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GHE Acme",
            external_id="ghe-dispatch-1",
            metadata={
                "domain_name": "github.acme.com",
                "installation_id": "1",
                "installation": {"id": "1", "private_key": "x", "verify_ssl": True},
            },
        )

        repository: Repository = {
            "id": 1,
            "integration_id": integration.id,
            "name": "acme/widget",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": "9001",
            "provider_name": "github_enterprise",
            "web_base_url": "https://github.acme.com",
            "installation_id": None,
        }
        provider = fetch_service_provider(self.organization.id, repository)

        assert isinstance(provider, GitHubProvider)

    def test_cursor_origin_returns_origin_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            name="acme",
            external_id="inst_01example",
        )
        repository: Repository = {
            "id": 1,
            "integration_id": integration.id,
            "name": "acme/rocket",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": "r_01example",
            "provider_name": "cursor_origin",
            "web_base_url": None,
            "installation_id": None,
        }

        provider = fetch_service_provider(self.organization.id, repository)

        assert isinstance(provider, CursorOriginProvider)
        assert provider.installation_id == "inst_01example"

    def test_github_enterprise_without_integration_returns_none(self) -> None:
        repository: Repository = {
            "id": 1,
            "integration_id": 99999,
            "name": "acme/widget",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": "9001",
            "provider_name": "github_enterprise",
            "web_base_url": "https://github.acme.com",
            "installation_id": None,
        }
        assert fetch_service_provider(self.organization.id, repository) is None

    def test_github_enterprise_client_error_returns_none(self) -> None:
        from unittest.mock import patch

        from sentry.shared_integrations.exceptions import IntegrationError

        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GHE Acme",
            external_id="ghe-clienterror-1",
            metadata={
                "domain_name": "github.acme.com",
                "installation_id": "1",
                "installation": {"id": "1", "private_key": "x", "verify_ssl": True},
            },
        )
        repository: Repository = {
            "id": 1,
            "integration_id": integration.id,
            "name": "acme/widget",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": "9001",
            "provider_name": "github_enterprise",
            "web_base_url": "https://github.acme.com",
            "installation_id": None,
        }

        with (
            patch(
                "sentry.scm.private.helpers.integration_service.get_integration",
                return_value=integration,
            ),
            patch.object(
                type(integration.get_installation(organization_id=self.organization.id)),
                "get_client",
                side_effect=IntegrationError("boom"),
            ),
        ):
            assert fetch_service_provider(self.organization.id, repository) is None


class TestMakeFetchers(TestCase):
    def test_fetchers_fetch_the_integration_once(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github_enterprise",
            name="GHE Acme",
            external_id="ghe-fetchers-1",
            metadata={
                "domain_name": "github.acme.com",
                "installation_id": "1",
                "installation": {"id": "1", "private_key": "x", "verify_ssl": True},
            },
        )
        repo = self.create_repo(
            project=self.project,
            name="acme/widget",
            provider="integrations:github_enterprise",
            external_id="9001",
            integration_id=integration.id,
        )
        fetchers = make_fetchers()

        with patch(
            "sentry.scm.private.helpers.integration_service", wraps=integration_service
        ) as service:
            repository = fetchers.fetch_repository(self.organization.id, repo.id)
            assert repository is not None
            provider = fetchers.fetch_provider(self.organization.id, repository)

        assert isinstance(provider, GitHubProvider)
        assert service.get_integration.call_count == 1


@cell_silo_test
class TestFetchAccessToken(TestCase):
    def scm_repository(
        self, integration_id: int, provider_name: ProviderName = "github"
    ) -> Repository:
        return Repository(
            external_id="1",
            id=1,
            integration_id=integration_id,
            is_active=True,
            name="getsentry/sentry",
            organization_id=self.organization.id,
            provider_name=provider_name,
            web_base_url=None,
            installation_id=None,
        )

    def test_returns_the_installation_token(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="1",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )

        token = fetch_access_token(self.scm_repository(integration.id), "fetch")

        assert token == TOKEN

    def test_returns_none_for_an_integration_the_organization_does_not_have(self) -> None:
        integration = self.create_integration(
            organization=self.create_organization(),
            provider="github",
            external_id="2",
            metadata={"access_token": TOKEN, "expires_at": TOKEN_EXPIRES_AT},
        )

        token = fetch_access_token(self.scm_repository(integration.id), "fetch")

        assert token is None

    @patch("sentry.scm.private.helpers.sentry_sdk.capture_exception")
    @patch(
        "sentry.scm.private.helpers.integration_service.get_access_token",
        side_effect=RpcRemoteException("integration", "get_access_token", "timed out"),
    )
    def test_returns_none_when_control_cannot_be_reached(
        self, mock_get_access_token: MagicMock, mock_capture_exception: MagicMock
    ) -> None:
        token = fetch_access_token(self.scm_repository(1), "fetch")

        assert token is None
        mock_capture_exception.assert_called_once_with()

    @patch("sentry.scm.private.helpers.sentry_sdk.capture_exception")
    @patch(
        "sentry.scm.private.helpers.integration_service.get_access_token",
        side_effect=RpcResponseException("integration", "get_access_token", "not JSON"),
    )
    def test_returns_none_when_control_answers_with_something_else(
        self, mock_get_access_token: MagicMock, mock_capture_exception: MagicMock
    ) -> None:
        token = fetch_access_token(self.scm_repository(1), "fetch")

        assert token is None
        mock_capture_exception.assert_called_once_with()

    @patch("sentry.scm.private.helpers.integration_service.get_access_token")
    def test_refuses_gitlab(self, mock_get_access_token: MagicMock) -> None:
        with pytest.raises(GitProviderNotSupported):
            fetch_access_token(self.scm_repository(1, "gitlab"), "fetch")

        mock_get_access_token.assert_not_called()
