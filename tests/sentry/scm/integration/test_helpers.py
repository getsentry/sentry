from unittest import mock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError
from sentry.scm.helpers import (
    fetch_repository,
    fetch_service_provider,
    is_rate_limited,
    is_rate_limited_with_allocation_policy,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.types import Referrer
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


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


class TestMapIntegrationToProvider(TestCase):
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

        provider = map_integration_to_provider(self.organization.id, integration)

        assert isinstance(provider, GitHubProvider)

    def test_raises_error_for_unsupported_provider(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="unsupported_provider",
            name="Unsupported Provider Test",
            external_id="1",
        )

        with mock.patch.object(integration, "get_installation"):
            with pytest.raises(SCMCodedError) as exc_info:
                map_integration_to_provider(self.organization.id, integration)

        assert exc_info.value.code == "integration_not_found"


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


class TestIsRateLimited(TestCase):
    def test_returns_false_when_under_limit(self):
        with freeze_time("2000-01-01"):
            result = is_rate_limited(
                organization_id=self.organization.id,
                referrer="shared",
                provider="github",
                limit=5,
                window=60,
            )

            assert result is False

    def test_returns_true_when_limit_exceeded(self):
        with freeze_time("2000-01-01"):
            for _ in range(5):
                is_rate_limited(
                    organization_id=self.organization.id,
                    referrer="shared",
                    provider="github",
                    limit=5,
                    window=60,
                )

            result = is_rate_limited(
                organization_id=self.organization.id,
                referrer="shared",
                provider="github",
                limit=5,
                window=60,
            )

            assert result is True

    def test_different_keys_are_independent(self):
        with freeze_time("2000-01-01"):
            for _ in range(5):
                is_rate_limited(
                    organization_id=self.organization.id,
                    referrer="shared",
                    provider="github",
                    limit=5,
                    window=60,
                )

            result = is_rate_limited(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                limit=5,
                window=60,
            )

            assert result is False


class TestIsRateLimitedWithAllocationPolicy(TestCase):
    def test_returns_false_when_under_allocated_limit(self):
        with freeze_time("2000-01-01"):
            allocation_policy: dict[Referrer, int] = {"emerge": 10, "shared": 100}

            result = is_rate_limited_with_allocation_policy(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                window=60,
                allocation_policy=allocation_policy,
            )

            assert result is False

    def test_falls_back_to_shared_pool_when_no_allocation(self):
        with freeze_time("2000-01-01"):
            allocation_policy: dict[Referrer, int] = {"emerge": 2, "shared": 100}

            for _ in range(2):
                is_rate_limited_with_allocation_policy(
                    organization_id=self.organization.id,
                    referrer="emerge",
                    provider="github",
                    window=60,
                    allocation_policy=allocation_policy,
                )

            result = is_rate_limited_with_allocation_policy(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                window=60,
                allocation_policy=allocation_policy,
            )

            assert result is True

    def test_returns_true_when_allocated_limit_exceeded(self):
        with freeze_time("2000-01-01"):
            allocation_policy: dict[Referrer, int] = {"emerge": 1, "shared": 1}

            for _ in range(2):
                is_rate_limited_with_allocation_policy(
                    organization_id=self.organization.id,
                    referrer="emerge",
                    provider="github",
                    window=60,
                    allocation_policy=allocation_policy,
                )

            result = is_rate_limited_with_allocation_policy(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                window=60,
                allocation_policy=allocation_policy,
            )

            assert result is True
