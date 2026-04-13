from unittest.mock import MagicMock

import pytest
from scm.errors import SCMCodedError
from scm.providers.github.provider import GitHubProvider
from scm.types import Repository

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.private.helpers import (
    fetch_repository,
    fetch_service_provider,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.testutils.cases import TestCase


class TestFetchRepository(TestCase):
    def test_fetch_by_id_returns_repository(self) -> None:
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is not None
        assert result["name"] == "test-org/test-repo"
        assert result["organization_id"] == self.organization.id
        assert result["is_active"] is True

    def test_fetch_by_id_returns_none_for_nonexistent(self) -> None:
        result = fetch_repository(self.organization.id, 99999)

        assert result is None

    def test_fetch_by_id_returns_none_for_wrong_organization(self) -> None:
        other_org = self.create_organization()
        repo = RepositoryModel.objects.create(
            organization_id=other_org.id,
            name="other-org/other-repo",
            provider="integrations:github",
            external_id="67890",
            status=ObjectStatus.ACTIVE,
        )

        result = fetch_repository(self.organization.id, repo.id)

        assert result is None

    def test_fetch_by_provider_and_external_id_returns_repository(self) -> None:
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
        )

        result = fetch_repository(self.organization.id, ("github", "12345"))

        assert result is not None
        assert result["name"] == "test-org/test-repo"

    def test_fetch_by_provider_and_external_id_returns_none_for_nonexistent(self) -> None:
        result = fetch_repository(self.organization.id, ("github", "nonexistent"))

        assert result is None


class TestMapRepositoryModelToRepository(TestCase):
    def test_maps_all_fields_correctly(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )
        repo = RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
            integration_id=integration.id,
        )

        result = map_repository_model_to_repository(repo)

        assert result["integration_id"] == integration.id
        assert result["name"] == "test-org/test-repo"
        assert result["organization_id"] == self.organization.id
        assert result["is_active"] is True


class TestMapIntegrationToProvider(TestCase):
    def test_returns_github_provider_for_github_integration(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )
        repository: Repository = {
            "integration_id": integration.id,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": False,
            "external_id": None,
        }

        provider = map_integration_to_provider(
            self.organization.id,
            integration,
            repository,
            get_installation=lambda _, oid: MagicMock(),
        )

        assert isinstance(provider, GitHubProvider)

    def test_raises_error_for_unsupported_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="integrations:github",
            name="Unsupported Provider Test",
            external_id="1",
        )
        repository: Repository = {
            "integration_id": integration.id,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": False,
            "external_id": None,
        }

        with pytest.raises(SCMCodedError) as exc_info:
            map_integration_to_provider(
                self.organization.id,
                integration,
                repository,
                get_installation=lambda _, oid: MagicMock(),
            )

        assert exc_info.value.code == "unsupported_integration"


class TestFetchServiceProvider(TestCase):
    def test_returns_provider_from_map_to_provider(self) -> None:
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )

        repository: Repository = {
            "integration_id": integration.id,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": None,
        }
        provider = fetch_service_provider(
            self.organization.id,
            repository,
            map_to_provider=lambda i, oid, r: map_integration_to_provider(
                oid, i, r, get_installation=lambda _, __: MagicMock()
            ),
        )

        assert isinstance(provider, GitHubProvider)

    def test_returns_none_for_nonexistent_integration(self) -> None:
        repository: Repository = {
            "integration_id": 99999,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "is_active": True,
            "external_id": None,
        }
        result = fetch_service_provider(self.organization.id, repository)
        assert result is None


def _make_active_repository(organization_id: int) -> Repository:
    return {
        "integration_id": 1,
        "name": "test-org/test-repo",
        "organization_id": organization_id,
        "is_active": True,
        "external_id": None,
    }


def _make_provider(is_rate_limited: bool = False):
    provider = MagicMock()
    provider.is_rate_limited.return_value = is_rate_limited
    return provider
