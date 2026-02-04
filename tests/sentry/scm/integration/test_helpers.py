from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError
from sentry.scm.helpers import (
    fetch_repository,
    fetch_service_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.providers.github import GitHubProvider
from sentry.testutils.cases import TestCase


class TestFetchRepository(TestCase):
    def test_fetch_by_id_returns_repository(self):
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
        assert result["status"] == ObjectStatus.ACTIVE

    def test_fetch_by_id_returns_none_for_nonexistent(self):
        result = fetch_repository(self.organization.id, 99999)

        assert result is None

    def test_fetch_by_id_returns_none_for_wrong_organization(self):
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

    def test_fetch_by_provider_and_external_id_returns_repository(self):
        RepositoryModel.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
        )

        result = fetch_repository(self.organization.id, ("integrations:github", "12345"))

        assert result is not None
        assert result["name"] == "test-org/test-repo"

    def test_fetch_by_provider_and_external_id_returns_none_for_nonexistent(self):
        result = fetch_repository(self.organization.id, ("integrations:github", "nonexistent"))

        assert result is None


class TestMapRepositoryModelToRepository(TestCase):
    def test_maps_all_fields_correctly(self):
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
        assert result["status"] == ObjectStatus.ACTIVE


class TestFetchServiceProvider(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_returns_github_provider_for_github_integration(self, mock_get_jwt):
        integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
            metadata={
                "access_token": "12345token",
                "expires_at": "2099-01-01T00:00:00",
            },
        )

        provider = fetch_service_provider(self.organization.id, integration.id)

        assert isinstance(provider, GitHubProvider)

    def test_raises_error_for_nonexistent_integration(self):
        with pytest.raises(SCMCodedError) as exc_info:
            fetch_service_provider(self.organization.id, 99999)

        assert exc_info.value.code == "integration_not_found"
