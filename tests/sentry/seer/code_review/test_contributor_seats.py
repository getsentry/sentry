from unittest.mock import patch

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.seer.code_review.contributor_seats import should_increment_contributor_seat
from sentry.testutils.cases import TestCase


class ShouldIncrementContributorSeatTest(TestCase):
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

        result = should_increment_contributor_seat(self.organization, self.repo, self.contributor)
        assert result is False

    def test_returns_false_when_no_code_review_or_autofix_enabled(self):
        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
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
            result = should_increment_contributor_seat(
                self.organization, repo_no_integration, self.contributor
            )
            assert result is False

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=True,
    )
    def test_returns_false_when_contributor_is_bot(self, mock_quota):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)
        self.contributor.alias = "testuser[bot]"
        self.contributor.save()

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=True,
    )
    def test_returns_true_when_code_review_enabled_and_quota_available(self, mock_quota):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is True
            mock_quota.assert_called_once()

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=True,
    )
    def test_returns_true_when_autofix_enabled_and_quota_available(self, mock_quota):
        self.create_code_mapping(project=self.project, repo=self.repo)
        self.project.update_option("sentry:autofix_automation_tuning", "medium")

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is True
            mock_quota.assert_called_once()

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=False,
    )
    def test_returns_false_when_quota_not_available(self, mock_quota):
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False
