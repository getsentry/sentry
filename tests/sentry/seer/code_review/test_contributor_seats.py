from unittest.mock import MagicMock, patch

from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributors,
)
from sentry.seer.code_review.contributor_seats import (
    should_increment_contributor_seat,
    track_contributor_seat,
)
from sentry.testutils.cases import TestCase


class ShouldIncrementContributorSeatTest(TestCase):
    def setUp(self) -> None:
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

    def test_returns_false_when_seat_based_seer_disabled(self) -> None:
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        result = should_increment_contributor_seat(self.organization, self.repo, self.contributor)
        assert result is False

    def test_returns_false_when_no_code_review_or_autofix_enabled(self) -> None:
        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    def test_returns_false_when_repo_has_no_integration_id(self) -> None:
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
    def test_returns_false_when_contributor_is_bot(self, mock_quota: MagicMock) -> None:
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
    def test_returns_true_when_code_review_enabled_and_quota_available(
        self, mock_quota: MagicMock
    ) -> None:
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
    def test_returns_true_when_autofix_enabled_and_quota_available(
        self, mock_quota: MagicMock
    ) -> None:
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
    def test_returns_false_when_quota_not_available(self, mock_quota: MagicMock) -> None:
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False


class TrackContributorSeatTest(TestCase):
    def setUp(self) -> None:
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

    def _call(self, user_id: str = "12345", user_username: str = "testuser") -> None:
        track_contributor_seat(
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            user_id=user_id,
            user_username=user_username,
            provider="github",
        )

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=False,
    )
    def test_creates_contributor_record(self, mock_should_increment: MagicMock) -> None:
        self._call(user_id="999", user_username="newuser")

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="999",
        )
        assert contributor.alias == "newuser"
        assert contributor.num_actions == 0

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=False,
    )
    def test_does_not_increment_when_should_increment_returns_false(
        self, mock_should_increment: MagicMock
    ) -> None:
        OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="12345",
            alias="testuser",
            num_actions=0,
        )

        self._call()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            external_identifier="12345",
        )
        assert contributor.num_actions == 0

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_increments_and_does_not_assign_below_threshold(
        self, mock_should_increment: MagicMock, mock_assign_seat: MagicMock
    ) -> None:
        self._call()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            external_identifier="12345",
        )
        assert contributor.num_actions == 1
        mock_assign_seat.delay.assert_not_called()

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_increments_and_assigns_at_threshold(
        self, mock_should_increment: MagicMock, mock_assign_seat: MagicMock
    ) -> None:
        OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="12345",
            alias="testuser",
            num_actions=ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD - 1,
        )

        self._call()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            external_identifier="12345",
        )
        assert contributor.num_actions == ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD
        mock_assign_seat.delay.assert_called_once_with(contributor.id)

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_handles_deleted_contributor_gracefully(
        self, mock_should_increment: MagicMock, mock_assign_seat: MagicMock
    ) -> None:
        contributor = OrganizationContributors.objects.create(
            organization=self.organization,
            integration_id=self.integration.id,
            external_identifier="12345",
            alias="testuser",
        )
        # Delete after creation so the select_for_update will fail
        OrganizationContributors.objects.filter(id=contributor.id).delete()

        # Should not raise
        self._call()
        mock_assign_seat.delay.assert_not_called()
