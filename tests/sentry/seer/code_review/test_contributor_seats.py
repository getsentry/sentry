from typing import Any
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributors,
)
from sentry.models.project import Project
from sentry.seer.code_review.contributor_seats import (
    _is_autofix_enabled_for_repo,
    should_increment_contributor_seat,
    track_contributor_seat,
)
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.seer.models.seer_api_models import SeerApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class IsAutofixEnabledForRepoTest(TestCase):
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
            external_id="123",
        )

    def _mock_preference(
        self, *, repository_id: int | None = None, external_id: str = "123"
    ) -> dict[str, Any]:
        repo: dict[str, Any] = {
            "provider": self.repo.provider,
            "owner": "owner",
            "name": "name",
            "external_id": external_id,
        }
        if repository_id is not None:
            repo["repository_id"] = repository_id
        return {
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "repositories": [repo],
        }

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    def test_seer_project_repository_exists_for_repo(self) -> None:
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is True

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    def test_no_seer_project_repository_exists(self) -> None:
        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    def test_seer_project_repository_exists_for_different_repo(
        self,
    ) -> None:
        other_repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        SeerProjectRepository.objects.create(project=self.project, repository=other_repo)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    def test_project_is_inactive(self) -> None:
        SeerProjectRepository.objects.create(project=self.project, repository=self.repo)
        self.project.update(status=ObjectStatus.PENDING_DELETION)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_organization_has_no_active_projects(self) -> None:
        Project.objects.filter(organization_id=self.organization.id).update(
            status=ObjectStatus.PENDING_DELETION
        )

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @patch("sentry.seer.code_review.contributor_seats.bulk_get_project_preferences")
    def test_preferences_resolve_to_repo(
        self, mock_bulk_get_project_preferences: MagicMock
    ) -> None:
        mock_bulk_get_project_preferences.return_value = {
            str(self.project.id): self._mock_preference(external_id=self.repo.external_id)
        }

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is True

    @patch("sentry.seer.code_review.contributor_seats.bulk_get_project_preferences")
    def test_repo_id_cannot_be_resolved(self, mock_bulk_get_project_preferences: MagicMock) -> None:
        mock_bulk_get_project_preferences.return_value = {
            str(self.project.id): self._mock_preference(external_id="unknown-external-id")
        }

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @patch("sentry.seer.code_review.contributor_seats.bulk_get_project_preferences")
    def test_preferences_exclude_repo(self, mock_bulk_get_project_preferences: MagicMock) -> None:
        mock_bulk_get_project_preferences.return_value = {
            str(self.project.id): self._mock_preference(repository_id=self.repo.id + 1)
        }

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @patch(
        "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
        return_value={},
    )
    def test_preferences_response_is_empty(
        self, mock_bulk_get_project_preferences: MagicMock
    ) -> None:
        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @patch(
        "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
        side_effect=SeerApiError("error", status=500),
    )
    def test_seer_api_error(self, mock_bulk_get_project_preferences: MagicMock) -> None:
        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    @patch(
        "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
        side_effect=ValueError("error"),
    )
    def test_unexpected_exception(self, mock_bulk_get_project_preferences: MagicMock) -> None:
        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False


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

    def _mock_preference(self, repository_id: int) -> dict[str, Any]:
        return {
            "organization_id": self.organization.id,
            "project_id": self.project.id,
            "repositories": [
                {
                    "provider": self.repo.provider,
                    "owner": "owner",
                    "name": "name",
                    "external_id": "external-id",
                    "repository_id": repository_id,
                },
            ],
        }

    def test_returns_false_when_seat_based_seer_disabled(self) -> None:
        self.create_repository_settings(repository=self.repo, enabled_code_review=True)

        result = should_increment_contributor_seat(self.organization, self.repo, self.contributor)
        assert result is False

    @patch(
        "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
        return_value={},
    )
    def test_returns_false_when_no_code_review_or_autofix_enabled(
        self, mock_bulk_get_project_preferences: MagicMock
    ) -> None:
        with self.feature("organizations:seat-based-seer-enabled"):
            result = should_increment_contributor_seat(
                self.organization, self.repo, self.contributor
            )
            assert result is False

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=True,
    )
    def test_returns_false_when_autofix_disabled(self, mock_quota: MagicMock) -> None:
        self.create_repository_settings(repository=self.repo, enabled_code_review=False)

        with self.subTest("no SeerProjectRepository row for repo when flag on"):
            other_repo = self.create_repo(
                project=self.project,
                provider="integrations:github",
                integration_id=self.integration.id,
            )
            SeerProjectRepository.objects.create(project=self.project, repository=other_repo)

            with self.feature(
                {
                    "organizations:seat-based-seer-enabled": True,
                    "organizations:seer-project-settings-read-from-sentry": True,
                }
            ):
                result = should_increment_contributor_seat(
                    self.organization, self.repo, self.contributor
                )
                assert result is False
                mock_quota.assert_not_called()

        mock_quota.reset_mock()

        with self.subTest("Seer preferences exclude repo when flag off"):
            with (
                patch(
                    "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
                    return_value={
                        str(self.project.id): self._mock_preference(repository_id=self.repo.id + 1)
                    },
                ),
                self.feature("organizations:seat-based-seer-enabled"),
            ):
                result = should_increment_contributor_seat(
                    self.organization, self.repo, self.contributor
                )
                assert result is False
                mock_quota.assert_not_called()

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
        with self.subTest("reads from SeerProjectRepository when flag on"):
            SeerProjectRepository.objects.create(project=self.project, repository=self.repo)

            with self.feature(
                {
                    "organizations:seat-based-seer-enabled": True,
                    "organizations:seer-project-settings-read-from-sentry": True,
                }
            ):
                result = should_increment_contributor_seat(
                    self.organization, self.repo, self.contributor
                )
                assert result is True
                mock_quota.assert_called_once()

        mock_quota.reset_mock()

        with self.subTest("reads from Seer preferences when flag off"):
            with (
                patch(
                    "sentry.seer.code_review.contributor_seats.bulk_get_project_preferences",
                    return_value={
                        str(self.project.id): self._mock_preference(repository_id=self.repo.id)
                    },
                ),
                self.feature("organizations:seat-based-seer-enabled"),
            ):
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
