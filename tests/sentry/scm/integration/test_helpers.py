from unittest.mock import MagicMock

import pytest

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository as RepositoryModel
from sentry.scm.errors import SCMCodedError, SCMProviderException, SCMUnhandledException
from sentry.scm.helpers import (
    exec_provider_fn,
    fetch_repository,
    fetch_service_provider,
    is_rate_limited,
    is_rate_limited_with_allocation_policy,
    map_integration_to_provider,
    map_repository_model_to_repository,
)
from sentry.scm.private.providers.github import GitHubProvider
from sentry.scm.types import Referrer, Repository
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

        result = fetch_repository(self.organization.id, ("github", "12345"))

        assert result is not None
        assert result["name"] == "test-org/test-repo"

    def test_fetch_by_provider_and_external_id_returns_none_for_nonexistent(self):
        result = fetch_repository(self.organization.id, ("github", "nonexistent"))

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
    def test_returns_github_provider_for_github_integration(self):
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
            "status": 0,
        }

        provider = map_integration_to_provider(
            self.organization.id,
            integration,
            repository,
            get_installation=lambda _, oid: MagicMock(),
        )

        assert isinstance(provider, GitHubProvider)

    def test_raises_error_for_unsupported_provider(self):
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
            "status": 0,
        }

        with pytest.raises(SCMCodedError) as exc_info:
            map_integration_to_provider(
                self.organization.id,
                integration,
                repository,
                get_installation=lambda _, oid: MagicMock(),
            )

        assert exc_info.value.code == "integration_not_found"


class TestFetchServiceProvider(TestCase):
    def test_returns_provider_from_map_to_provider(self):
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
            "status": 0,
        }
        provider = fetch_service_provider(
            self.organization.id,
            repository,
            map_to_provider=lambda i, oid, r: map_integration_to_provider(
                oid, i, r, get_installation=lambda _, __: MagicMock()
            ),
        )

        assert isinstance(provider, GitHubProvider)

    def test_raises_error_for_nonexistent_integration(self):
        repository: Repository = {
            "integration_id": 99999,
            "name": "test-org/test-repo",
            "organization_id": self.organization.id,
            "status": 0,
        }
        with pytest.raises(SCMCodedError) as exc_info:
            fetch_service_provider(self.organization.id, repository)

        assert exc_info.value.code == "unsupported_integration"


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

    def test_falls_back_to_shared_pool_when_allocation_exhausted(self):
        with freeze_time("2000-01-01"):
            allocation_policy: dict[Referrer, int] = {"emerge": 2, "shared": 100}

            # Exhaust the dedicated allocation.
            for _ in range(2):
                is_rate_limited_with_allocation_policy(
                    organization_id=self.organization.id,
                    referrer="emerge",
                    provider="github",
                    window=60,
                    allocation_policy=allocation_policy,
                )

            # Falls back to the shared pool which still has quota.
            result = is_rate_limited_with_allocation_policy(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                window=60,
                allocation_policy=allocation_policy,
            )

            assert result is False

    def test_returns_true_when_allocation_and_shared_pool_exhausted(self):
        with freeze_time("2000-01-01"):
            allocation_policy: dict[Referrer, int] = {"emerge": 1, "shared": 1}

            # Exhaust the dedicated allocation.
            is_rate_limited_with_allocation_policy(
                organization_id=self.organization.id,
                referrer="emerge",
                provider="github",
                window=60,
                allocation_policy=allocation_policy,
            )

            # Exhaust the shared pool.
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


def _make_active_repository(organization_id: int) -> Repository:
    return {
        "integration_id": 1,
        "name": "test-org/test-repo",
        "organization_id": organization_id,
        "status": ObjectStatus.ACTIVE,
    }


def _make_provider(is_rate_limited: bool = False):
    provider = MagicMock()
    provider.is_rate_limited.return_value = is_rate_limited
    return provider


class TestExecProviderFn(TestCase):
    def test_returns_provider_fn_result(self):
        org_id = self.organization.id
        repository = _make_active_repository(org_id)
        provider = _make_provider()

        result = exec_provider_fn(
            org_id,
            1,
            fetch_repository=lambda _, __: repository,
            fetch_service_provider=lambda _, __: provider,
            provider_fn=lambda p: "success",
        )

        assert result == "success"

    def test_raises_repository_not_found(self):
        with pytest.raises(SCMCodedError) as exc_info:
            exec_provider_fn(
                self.organization.id,
                99999,
                fetch_repository=lambda _, __: None,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=lambda p: None,
            )
        assert exc_info.value.code == "repository_not_found"

    def test_raises_repository_inactive(self):
        repository = _make_active_repository(self.organization.id)
        repository["status"] = ObjectStatus.PENDING_DELETION

        with pytest.raises(SCMCodedError) as exc_info:
            exec_provider_fn(
                self.organization.id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=lambda p: None,
            )
        assert exc_info.value.code == "repository_inactive"

    def test_raises_repository_organization_mismatch(self):
        repository = _make_active_repository(organization_id=99999)

        with pytest.raises(SCMCodedError) as exc_info:
            exec_provider_fn(
                self.organization.id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=lambda p: None,
            )
        assert exc_info.value.code == "repository_organization_mismatch"

    def test_raises_rate_limit_exceeded(self):
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        with pytest.raises(SCMCodedError) as exc_info:
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(is_rate_limited=True),
                provider_fn=lambda p: None,
            )
        assert exc_info.value.code == "rate_limit_exceeded"

    def test_scm_provider_exception_is_reraised(self):
        """SCMError subclasses from provider_fn should pass through unwrapped."""
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        def raise_scm_provider_exception(provider):
            raise SCMProviderException("API failure")

        with pytest.raises(SCMProviderException, match="API failure"):
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=raise_scm_provider_exception,
            )

    def test_scm_coded_error_is_reraised(self):
        """SCMCodedError from provider_fn should pass through unwrapped."""
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        def raise_scm_coded_error(provider):
            raise SCMCodedError(code="unsupported_integration")

        with pytest.raises(SCMCodedError) as exc_info:
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=raise_scm_coded_error,
            )
        assert exc_info.value.code == "unsupported_integration"

    def test_generic_exception_wrapped_in_scm_unhandled_exception(self):
        """Non-SCMError exceptions should be wrapped in SCMUnhandledException."""
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        def raise_value_error(provider):
            raise ValueError("something unexpected")

        with pytest.raises(SCMUnhandledException) as exc_info:
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=raise_value_error,
            )
        assert isinstance(exc_info.value.__cause__, ValueError)
        assert "something unexpected" in str(exc_info.value.__cause__)

    def test_key_error_wrapped_in_scm_unhandled_exception(self):
        """KeyError (e.g. from malformed response) should be wrapped."""
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        def raise_key_error(provider):
            raise KeyError("missing_field")

        with pytest.raises(SCMUnhandledException) as exc_info:
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=raise_key_error,
            )
        assert isinstance(exc_info.value.__cause__, KeyError)

    def test_runtime_error_wrapped_in_scm_unhandled_exception(self):
        """RuntimeError should be wrapped in SCMUnhandledException."""
        org_id = self.organization.id
        repository = _make_active_repository(org_id)

        def raise_runtime_error(provider):
            raise RuntimeError("unexpected state")

        with pytest.raises(SCMUnhandledException) as exc_info:
            exec_provider_fn(
                org_id,
                1,
                fetch_repository=lambda _, __: repository,
                fetch_service_provider=lambda _, __: _make_provider(),
                provider_fn=raise_runtime_error,
            )
        assert isinstance(exc_info.value.__cause__, RuntimeError)
