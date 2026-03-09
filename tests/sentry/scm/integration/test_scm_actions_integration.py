from datetime import timedelta
from unittest import mock

import pytest
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.scm.actions import SourceCodeManager
from sentry.scm.errors import SCMCodedError
from sentry.scm.private.providers.github import GitHubProvider
from sentry.testutils.cases import TestCase


class TestMakeFromRepositoryId(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, mock_get_jwt):
        super().setUp()
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub",
            external_id="12345",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = self.create_repo(
            name="test-org/test-repo",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="67890",
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_success_with_integer_repository_id(self, mock_get_jwt):
        scm = SourceCodeManager.make_from_repository_id(
            self.organization.id,
            self.repo.id,
        )

        assert isinstance(scm.provider, GitHubProvider)
        assert scm.referrer == "shared"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_success_with_composite_repository_id(self, mock_get_jwt):
        scm = SourceCodeManager.make_from_repository_id(
            self.organization.id,
            ("github", "67890"),
        )

        assert isinstance(scm.provider, GitHubProvider)

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_custom_referrer_is_stored(self, mock_get_jwt):
        scm = SourceCodeManager.make_from_repository_id(
            self.organization.id,
            self.repo.id,
            referrer="emerge",
        )

        assert scm.referrer == "emerge"

    def test_raises_repository_not_found_for_nonexistent_id(self):
        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_repository_id(
                self.organization.id,
                99999,
            )

        assert exc_info.value.code == "repository_not_found"

    def test_raises_repository_not_found_for_nonexistent_composite_id(self):
        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_repository_id(
                self.organization.id,
                ("github", "nonexistent"),
            )

        assert exc_info.value.code == "repository_not_found"

    def test_raises_repository_inactive(self):
        self.repo.status = ObjectStatus.DISABLED
        self.repo.save()

        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_repository_id(
                self.organization.id,
                self.repo.id,
            )

        assert exc_info.value.code == "repository_inactive"

    def test_raises_repository_not_found_for_wrong_organization(self):
        other_org = self.create_organization()

        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_repository_id(
                other_org.id,
                self.repo.id,
            )

        assert exc_info.value.code == "repository_not_found"

    def test_raises_integration_not_found_when_no_integration_exists(self):
        repo = self.create_repo(
            name="test-org/orphan-repo",
            provider="integrations:github",
            integration_id=99999,
            external_id="11111",
        )

        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_repository_id(
                self.organization.id,
                repo.id,
            )

        assert exc_info.value.code == "integration_not_found"


class TestMakeFromIntegration(TestCase):
    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def setUp(self, mock_get_jwt):
        super().setUp()
        ten_days = timezone.now() + timedelta(days=10)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Test GitHub",
            external_id="12345",
            metadata={
                "access_token": "12345token",
                "expires_at": ten_days.strftime("%Y-%m-%dT%H:%M:%S"),
            },
        )
        self.repo = self.create_repo(
            name="test-org/test-repo",
            provider="integrations:github",
            integration_id=self.integration.id,
            external_id="67890",
        )

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_success_with_github_integration(self, mock_get_jwt):
        scm = SourceCodeManager.make_from_integration(
            self.organization.id,
            self.repo,
            self.integration,
        )

        assert isinstance(scm.provider, GitHubProvider)
        assert scm.referrer == "shared"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_custom_referrer_is_stored(self, mock_get_jwt):
        scm = SourceCodeManager.make_from_integration(
            self.organization.id,
            self.repo,
            self.integration,
            referrer="emerge",
        )

        assert scm.referrer == "emerge"

    @mock.patch(
        "sentry.scm.actions.map_integration_to_provider",
        side_effect=SCMCodedError(code="unsupported_integration"),
    )
    def test_raises_unsupported_integration_for_unknown_provider(self, mock_map):
        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_integration(
                self.organization.id,
                self.repo,
                self.integration,
            )

        assert exc_info.value.code == "unsupported_integration"

    @mock.patch("sentry.integrations.github.client.get_jwt", return_value="jwt_token_1")
    def test_raises_repository_inactive(self, mock_get_jwt):
        self.repo.status = ObjectStatus.DISABLED
        self.repo.save()

        with pytest.raises(SCMCodedError) as exc_info:
            SourceCodeManager.make_from_integration(
                self.organization.id,
                self.repo,
                self.integration,
            )

        assert exc_info.value.code == "repository_inactive"
