from scm.providers.github.provider import GitHubProvider
from scm.types import Repository

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.helpers import fetch_repository, fetch_service_provider
from sentry.testutils.cases import TestCase


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
