from unittest.mock import patch

import pytest

from sentry.integrations.github.utils import (
    parse_github_blob_url,
    should_create_or_increment_contributor_seat,
)
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.testutils.cases import TestCase


class ShouldCreateOrIncrementContributorSeatTest(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            external_id="github:1",
        )
        self.repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.contributor = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="12345",
            alias="testuser",
        )

    def test_returns_false_when_seat_based_seer_disabled(self):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        result = should_create_or_increment_contributor_seat(
            self.organization, self.repo, self.contributor
        )
        assert result is False

    def test_returns_false_for_code_review_beta_orgs(self):
        self.create_code_mapping(project=self.project, repo=self.repo)
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature(
            ["organizations:seat-based-seer-enabled", "organizations:code-review-beta"]
        ):
            result = should_create_or_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    def test_returns_false_when_no_code_review_or_autofix_enabled(self):
        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_create_or_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    def test_returns_false_when_repo_has_no_integration_id(self):
        repo_no_integration = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=None,
        )
        self.create_repository_settings(repository=repo_no_integration, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_create_or_increment_contributor_seat(
                self.organization, repo_no_integration, self.contributor
            )
            assert result is False

    @patch("sentry.integrations.github.utils.quotas.backend.check_seer_quota", return_value=True)
    def test_returns_true_when_code_review_enabled_and_quota_available(self, mock_quota):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_create_or_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is True
            mock_quota.assert_called_once()

    @patch("sentry.integrations.github.utils.quotas.backend.check_seer_quota", return_value=False)
    def test_returns_false_when_quota_not_available(self, mock_quota):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_create_or_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    @patch("sentry.integrations.github.utils.quotas.backend.check_seer_quota", return_value=True)
    def test_returns_true_when_autofix_enabled(self, mock_quota):
        self.create_code_mapping(project=self.project, repo=self.repo)
        self.project.update_option("sentry:autofix_automation_tuning", "medium")

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_create_or_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is True


@pytest.mark.parametrize(
    "repo_url,source_url,expected_branch,expected_path",
    [
        (
            "https://github.com/owner/repo",
            "https://github.com/owner/repo/blob/main/path/to/file.py",
            "main",
            "path/to/file.py",
        ),
        (
            # Trailing slash on repo URL should be handled
            "https://github.com/owner/repo/",
            "https://github.com/owner/repo/blob/main/path/to/file.py",
            "main",
            "path/to/file.py",
        ),
        (
            # GitHub Enterprise style URL
            "https://github.example.org/org/repo",
            "https://github.example.org/org/repo/blob/master/src/app/index.ts",
            "master",
            "src/app/index.ts",
        ),
        (
            # No '/blob/' segment → not parseable
            "https://github.com/owner/repo",
            "https://github.com/owner/repo/tree/main/path/to/file.py",
            "",
            "",
        ),
    ],
)
def test_parse_github_blob_url(repo_url, source_url, expected_branch, expected_path):
    branch, path = parse_github_blob_url(repo_url, source_url)
    assert branch == expected_branch
    assert path == expected_path
