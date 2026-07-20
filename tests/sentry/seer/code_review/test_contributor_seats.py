from unittest.mock import MagicMock, patch

import pytest
from django.db import IntegrityError

from sentry.constants import ObjectStatus
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.utils.hostname import InstanceHostnameError
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributorAction,
    OrganizationContributors,
)
from sentry.models.project import Project
from sentry.seer.code_review.contributor_seats import (
    _is_autofix_enabled_for_repo,
    get_or_create_contributor,
    record_contributor_action,
    should_increment_contributor_seat,
    track_contributor_seat,
)
from sentry.testutils.cases import TestCase


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

    def test_seer_project_repository_exists_for_repo(self) -> None:
        self.create_seer_project_repository(project=self.project, repository=self.repo)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is True

    def test_no_seer_project_repository_exists(self) -> None:
        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_seer_project_repository_exists_for_different_repo(self) -> None:
        other_repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.create_seer_project_repository(project=self.project, repository=other_repo)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_project_is_inactive(self) -> None:
        self.create_seer_project_repository(project=self.project, repository=self.repo)
        self.project.update(status=ObjectStatus.PENDING_DELETION)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_organization_has_no_active_projects(self) -> None:
        Project.objects.filter(organization_id=self.organization.id).update(
            status=ObjectStatus.PENDING_DELETION
        )

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_repo_is_inactive(self) -> None:
        self.create_seer_project_repository(project=self.project, repository=self.repo)
        self.repo.status = ObjectStatus.DISABLED
        self.repo.save()

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is False

    def test_returns_true_via_project_repository_fk(self) -> None:
        self.create_seer_project_repository(project=self.project, repository=self.repo)

        assert _is_autofix_enabled_for_repo(self.organization, self.repo.id) is True


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

    @patch(
        "sentry.seer.code_review.contributor_seats.quotas.backend.check_seer_quota",
        return_value=True,
    )
    def test_returns_false_when_autofix_disabled(self, mock_quota: MagicMock) -> None:
        """SeerProjectRepository for a different repo → autofix is not enabled for self.repo."""
        self.create_repository_settings(repository=self.repo, enabled_code_review=False)
        other_repo = self.create_repo(
            project=self.project,
            provider="integrations:github",
            integration_id=self.integration.id,
        )
        self.create_seer_project_repository(project=self.project, repository=other_repo)

        with self.feature("organizations:seat-based-seer-enabled"):
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
        self.create_seer_project_repository(project=self.project, repository=self.repo)

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
            integration=serialize_integration(self.integration),
            user_id=user_id,
            user_username=user_username,
        )

    @patch("sentry.seer.code_review.contributor_seats.logger")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=False,
    )
    def test_not_eligible_seeds_contributor_without_logging(
        self, mock_should_increment: MagicMock, mock_logger: MagicMock
    ) -> None:
        self._call(user_id="999", user_username="newuser")

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="999",
        )
        assert contributor.alias == "newuser"
        assert contributor.provider == "github"
        assert contributor.hostname == "github.com"
        assert contributor.num_actions == 0
        mock_logger.info.assert_not_called()

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch("sentry.seer.code_review.contributor_seats.logger")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_eligible_logs_but_does_not_assign_seat(
        self,
        mock_should_increment: MagicMock,
        mock_logger: MagicMock,
        mock_assign_seat: MagicMock,
    ) -> None:
        self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="12345",
            provider=self.integration.provider,
            alias="testuser",
            num_actions=5,
        )

        self._call()

        contributor = OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            external_identifier="12345",
        )
        assert contributor.num_actions == 5
        mock_assign_seat.delay.assert_not_called()

        mock_logger.info.assert_called_once()
        assert (
            mock_logger.info.call_args.args[0]
            == "scm.webhook.organization_contributor.num_actions_should_increment"
        )

    @patch("sentry.seer.code_review.contributor_seats.sentry_sdk.capture_exception")
    @patch(
        "sentry.seer.code_review.contributor_seats.instance_hostname",
        side_effect=InstanceHostnameError("missing"),
    )
    def test_missing_hostname_captures_and_skips_seeding(
        self, mock_hostname: MagicMock, mock_capture: MagicMock
    ) -> None:
        self._call(user_id="999")

        assert not OrganizationContributors.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="999",
        ).exists()
        mock_capture.assert_called_once()


class RecordContributorActionTest(TestCase):
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

    def _contributor(self) -> OrganizationContributors:
        return OrganizationContributors.objects.get(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="123",
        )

    def _action_count(self, pr_number: str = "5") -> int:
        return OrganizationContributorAction.objects.filter(
            repository_id=self.repo.id, pr_number=pr_number
        ).count()

    def _call(self, *, pr_number: int = 5, is_opened: bool = True) -> None:
        record_contributor_action(
            organization=self.organization,
            repo=self.repo,
            integration=serialize_integration(self.integration),
            user_id="123",
            user_username="alice",
            pr_number=pr_number,
            is_opened=is_opened,
        )

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=False,
    )
    def test_not_eligible_does_not_record_action(self, mock_should: MagicMock) -> None:
        self._call()

        contributor = self._contributor()
        assert contributor.alias == "alice"
        assert contributor.provider == "github"
        assert contributor.hostname == "github.com"
        assert contributor.num_actions == 0
        assert self._action_count() == 0

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_opened_and_eligible_records_action_and_increments(
        self, mock_should: MagicMock
    ) -> None:
        self._call()

        contributor = self._contributor()
        action = OrganizationContributorAction.objects.get(
            repository_id=self.repo.id, pr_number="5"
        )
        assert action.organization_contributor_id == contributor.id
        assert contributor.num_actions == 1

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_not_opened_does_not_record_action(self, mock_should: MagicMock) -> None:
        self._call(is_opened=False)

        self._contributor()
        assert self._action_count() == 0

    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_records_idempotently(self, mock_should: MagicMock) -> None:
        for _ in range(2):
            self._call()

        assert self._action_count() == 1
        assert self._contributor().num_actions == 1

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_increments_and_does_not_assign_below_threshold(
        self, mock_should: MagicMock, mock_assign: MagicMock
    ) -> None:
        self._call()

        assert self._contributor().num_actions == 1
        mock_assign.delay.assert_not_called()

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_increments_and_assigns_at_threshold(
        self, mock_should: MagicMock, mock_assign: MagicMock
    ) -> None:
        self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="123",
            provider=self.integration.provider,
            alias="alice",
            num_actions=ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD - 1,
        )

        self._call()

        contributor = self._contributor()
        assert contributor.num_actions == ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD
        mock_assign.delay.assert_called_once_with(contributor.id)

    @patch("sentry.seer.code_review.contributor_seats.assign_seat_to_organization_contributor")
    @patch(
        "sentry.seer.code_review.contributor_seats.should_increment_contributor_seat",
        return_value=True,
    )
    def test_increments_and_assigns_above_threshold(
        self, mock_should: MagicMock, mock_assign: MagicMock
    ) -> None:
        self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="123",
            provider=self.integration.provider,
            alias="alice",
            num_actions=ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
        )

        self._call()

        contributor = self._contributor()
        assert contributor.num_actions == ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD + 1
        mock_assign.delay.assert_called_once_with(contributor.id)

    @patch("sentry.seer.code_review.contributor_seats.sentry_sdk.capture_exception")
    @patch(
        "sentry.seer.code_review.contributor_seats.instance_hostname",
        side_effect=InstanceHostnameError("missing"),
    )
    def test_missing_hostname_captures_and_skips_seeding(
        self, mock_hostname: MagicMock, mock_capture: MagicMock
    ) -> None:
        self._call()

        assert not OrganizationContributors.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier="123",
        ).exists()
        assert self._action_count() == 0
        mock_capture.assert_called_once()


class GetOrCreateContributorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:1"
        )
        # Second github integration -> same provider/hostname, so rows created via
        # each land in the same (org, provider, hostname, external_identifier) group.
        self.other_integration = self.create_integration(
            organization=self.organization, provider="github", external_id="github:2"
        )

    def _call(
        self,
        integration: Integration | None = None,
        external_identifier: str = "123",
        alias: str | None = "alice",
    ) -> OrganizationContributors | None:
        return get_or_create_contributor(
            organization=self.organization,
            integration=integration or self.integration,
            external_identifier=external_identifier,
            alias=alias,
        )

    def _group_count(self, external_identifier: str = "123") -> int:
        return OrganizationContributors.objects.filter(
            organization_id=self.organization.id, external_identifier=external_identifier
        ).count()

    def test_creates_when_none_exists(self) -> None:
        contributor = self._call()

        assert contributor is not None
        assert OrganizationContributors.objects.filter(id=contributor.id).exists()
        assert contributor.provider == "github"
        assert contributor.hostname == "github.com"
        assert contributor.external_identifier == "123"
        assert contributor.alias == "alice"

    def test_returns_existing_without_creating(self) -> None:
        existing = self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="123",
        )

        contributor = self._call()

        assert contributor is not None
        assert contributor.id == existing.id
        assert self._group_count() == 1

    @patch("sentry.seer.code_review.contributor_seats.get_canonical_contributor")
    def test_integrityerror_returns_existing_on_race(self, mock_get_canonical: MagicMock) -> None:
        existing = self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="123",
        )
        # Race: first lookup misses, our create loses to a concurrent insert
        # (IntegrityError), retry lookup finds the winner.
        mock_get_canonical.side_effect = [None, existing]
        with patch.object(
            OrganizationContributors.objects, "create", side_effect=IntegrityError("dupe")
        ):
            contributor = self._call()

        assert contributor is not None
        assert contributor.id == existing.id

    @patch("sentry.seer.code_review.contributor_seats.get_canonical_contributor")
    def test_integrityerror_reraises_when_still_missing(
        self, mock_get_canonical: MagicMock
    ) -> None:
        # Both lookups miss but create keeps failing -> propagate.
        mock_get_canonical.side_effect = [None, None]
        with (
            patch.object(
                OrganizationContributors.objects, "create", side_effect=IntegrityError("dupe")
            ),
            pytest.raises(IntegrityError),
        ):
            self._call()

    def test_returns_existing_when_looked_up_via_different_integration(self) -> None:
        existing = self.create_organization_contributor(
            organization=self.organization,
            integration=self.integration,
            external_identifier="123",
        )

        contributor = self._call(integration=self.other_integration)

        assert contributor is not None
        assert contributor.id == existing.id
        assert self._group_count() == 1

    @patch("sentry.seer.code_review.contributor_seats.sentry_sdk.capture_exception")
    @patch(
        "sentry.seer.code_review.contributor_seats.instance_hostname",
        side_effect=InstanceHostnameError("missing"),
    )
    def test_returns_none_on_missing_hostname(
        self, mock_hostname: MagicMock, mock_capture: MagicMock
    ) -> None:
        assert self._call() is None
        assert self._group_count() == 0
        mock_capture.assert_called_once()
