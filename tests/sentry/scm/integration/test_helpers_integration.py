from scm.facade import Facade
from scm.providers.gitea.provider import GiteaProvider
from scm.providers.github.provider import GitHubProvider
from scm.types import (
    GetPullRequestProtocol,
    GetRepositoryProtocol,
    GetReviewCommentReactionsProtocol,
    ListCheckRunsForRefProtocol,
    Repository,
)

from fixtures.gitea import BASE_URL, REPO_PATH, GiteaTestCase
from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.helpers import fetch_repository, fetch_service_provider
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


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
        }
        provider = fetch_service_provider(self.organization.id, repository)

        assert isinstance(provider, GitHubProvider)

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


class TestFetchGiteaRepository(GiteaTestCase):
    """Gitea's ROOT_URL is free-form, so `web_base_url` cannot be rebuilt from a
    hostname the way `github_enterprise`'s is."""

    def test_fetch_gitea_repo_populates_web_base_url(self) -> None:
        repo = self.create_gitea_repo()

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["provider_name"] == "gitea"
        assert result["web_base_url"] == BASE_URL
        # The provider addresses repositories by `{owner}/{name}` path segments.
        assert result["name"] == REPO_PATH

    def test_web_base_url_preserves_sub_path_install(self) -> None:
        """`instance`/`domain_name` are hostname-only and would drop the sub-path."""
        sub_path_url = f"{BASE_URL}/gitea"
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(
                metadata={**self.integration.metadata, "base_url": sub_path_url}
            )
        repo = self.create_gitea_repo()

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["web_base_url"] == sub_path_url


class TestFetchGiteaServiceProvider(GiteaTestCase):
    def test_gitea_returns_gitea_provider(self) -> None:
        repo = self.create_gitea_repo()
        repository = fetch_repository(self.organization.id, repo.id)
        assert repository is not None

        provider = fetch_service_provider(self.organization.id, repository)

        assert isinstance(provider, GiteaProvider)
        assert provider.web_base_url == BASE_URL
        assert provider.repo_path == REPO_PATH
        assert provider.build_url("/user") == f"{BASE_URL}/api/v1/user"

    def test_gitea_exposes_the_seer_capabilities(self) -> None:
        """The point of the wiring: Seer guards on these before acting."""
        repo = self.create_gitea_repo()
        repository = fetch_repository(self.organization.id, repo.id)
        assert repository is not None
        provider = fetch_service_provider(self.organization.id, repository)
        assert provider is not None

        facade = Facade(provider, record_count=lambda *a: None)

        assert isinstance(facade, GetRepositoryProtocol)
        assert isinstance(facade, GetPullRequestProtocol)
        assert isinstance(facade, ListCheckRunsForRefProtocol)
        # Gitea has no counterpart to GitHub's /pulls/comments/{id}/reactions,
        # so this capability is absent and callers skip the behavior.
        assert not isinstance(facade, GetReviewCommentReactionsProtocol)

    def test_gitea_without_web_base_url_returns_none(self) -> None:
        """A repository missing the base URL is unusable; fail into ProviderNotFound."""
        repo = self.create_gitea_repo()
        repository = fetch_repository(self.organization.id, repo.id)
        assert repository is not None
        repository["web_base_url"] = None

        assert fetch_service_provider(self.organization.id, repository) is None
