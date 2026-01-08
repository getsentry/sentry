from unittest.mock import MagicMock, patch

from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repositorysettings import CodeReviewTrigger, RepositorySettings
from sentry.seer.code_review.preflight import CodeReviewPreflightService, PreflightDenialReason
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class TestCodeReviewPreflightService(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.repo = self.create_repo(project=self.project)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration = self.create_integration(
                organization=self.organization,
                provider="github",
                external_id="github:123",
            )
        self.external_identifier = "user123"

    def _create_service(
        self,
        integration_id: int | None = None,
        external_identifier: str | None = None,
    ) -> CodeReviewPreflightService:
        return CodeReviewPreflightService(
            organization=self.organization,
            repo=self.repo,
            integration_id=integration_id if integration_id is not None else self.integration.id,
            pr_author_external_id=(
                external_identifier if external_identifier is not None else self.external_identifier
            ),
        )

    # -------------------------------------------------------------------------
    # Legal AI consent tests
    # -------------------------------------------------------------------------

    def test_denied_when_gen_ai_feature_flag_disabled(self) -> None:
        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.ORG_LEGAL_AI_CONSENT_NOT_GRANTED

    @with_feature("organizations:gen-ai-features")
    def test_denied_when_hide_ai_features_enabled(self) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)

        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.ORG_LEGAL_AI_CONSENT_NOT_GRANTED

    # -------------------------------------------------------------------------
    # Org feature enablement tests
    # -------------------------------------------------------------------------

    @with_feature("organizations:gen-ai-features")
    def test_denied_when_org_not_eligible_for_code_review(self) -> None:
        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW

    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_denied_when_beta_org_has_legacy_toggle_disabled(self) -> None:
        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.ORG_PR_REVIEW_LEGACY_TOGGLE_DISABLED

    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_allowed_when_beta_org_has_legacy_toggle_enabled(self) -> None:
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        with patch(
            "sentry.seer.code_review.billing.quotas.backend.check_seer_quota",
            return_value=True,
        ):
            service = self._create_service()
            result = service.check()

        assert result.allowed is True
        assert result.denial_reason is None

    @with_feature("organizations:gen-ai-features")
    def test_allowed_when_org_is_legacy_opt_in_without_beta_flag(self) -> None:
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        with patch(
            "sentry.seer.code_review.billing.quotas.backend.check_seer_quota",
            return_value=True,
        ):
            service = self._create_service()
            result = service.check()

        assert result.allowed is True
        assert result.denial_reason is None

    # -------------------------------------------------------------------------
    # Seat-based org tests
    # -------------------------------------------------------------------------

    @with_feature(["organizations:gen-ai-features", "organizations:seat-based-seer-enabled"])
    def test_denied_when_seat_based_org_has_no_repo_settings(self) -> None:
        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.REPO_CODE_REVIEW_DISABLED

    @with_feature(["organizations:gen-ai-features", "organizations:seat-based-seer-enabled"])
    def test_denied_when_seat_based_org_has_repo_settings_disabled(self) -> None:
        RepositorySettings.objects.create(
            repository=self.repo,
            enabled_code_review=False,
        )
        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.REPO_CODE_REVIEW_DISABLED

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    @with_feature(["organizations:gen-ai-features", "organizations:seat-based-seer-enabled"])
    def test_allowed_when_seat_based_org_has_repo_settings_enabled(
        self, mock_check_quota: MagicMock
    ) -> None:
        mock_check_quota.return_value = True

        RepositorySettings.objects.create(
            repository=self.repo,
            enabled_code_review=True,
        )

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        service = self._create_service()
        result = service.check()

        assert result.allowed is True
        assert result.denial_reason is None
        assert result.settings is not None
        assert result.settings.enabled is True

    # -------------------------------------------------------------------------
    # Settings retrieval tests
    # -------------------------------------------------------------------------

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    @with_feature(["organizations:gen-ai-features", "organizations:seat-based-seer-enabled"])
    def test_returns_repo_settings_when_allowed(self, mock_check_quota: MagicMock) -> None:
        mock_check_quota.return_value = True

        RepositorySettings.objects.create(
            repository=self.repo,
            enabled_code_review=True,
            code_review_triggers=[
                CodeReviewTrigger.ON_COMMAND_PHRASE.value,
                CodeReviewTrigger.ON_READY_FOR_REVIEW.value,
            ],
        )

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        service = self._create_service()
        result = service.check()

        assert result.allowed is True
        assert result.settings is not None
        assert result.settings.enabled is True
        assert CodeReviewTrigger.ON_COMMAND_PHRASE in result.settings.triggers
        assert CodeReviewTrigger.ON_READY_FOR_REVIEW in result.settings.triggers

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_returns_none_settings_for_beta_org_without_repo_settings(
        self, mock_check_quota: MagicMock
    ) -> None:
        mock_check_quota.return_value = True

        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        service = self._create_service()
        result = service.check()

        assert result.allowed is True
        assert result.settings is None

    # -------------------------------------------------------------------------
    # Billing tests
    # -------------------------------------------------------------------------


# TODO: Uncomment these billing tests once we're ready to actually gate billing (when it's time for GA)
"""
    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_denied_when_missing_integration_id(self) -> None:
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        service = CodeReviewPreflightService(
            organization=self.organization,
            repo=self.repo,
            integration_id=None,
            pr_author_external_id=self.external_identifier,
        )
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.BILLING_MISSING_CONTRIBUTOR_INFO

    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_denied_when_missing_external_identifier(self) -> None:
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        service = CodeReviewPreflightService(
            organization=self.organization,
            repo=self.repo,
            integration_id=self.integration.id,
            pr_author_external_id=None,
        )
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.BILLING_MISSING_CONTRIBUTOR_INFO

    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_denied_when_contributor_does_not_exist(self) -> None:
        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.BILLING_QUOTA_EXCEEDED

    @patch("sentry.seer.code_review.billing.quotas.backend.check_seer_quota")
    @with_feature(["organizations:gen-ai-features", "organizations:code-review-beta"])
    def test_denied_when_quota_check_fails(self, mock_check_quota: MagicMock) -> None:
        mock_check_quota.return_value = False

        self.organization.update_option("sentry:enable_pr_review_test_generation", True)

        OrganizationContributors.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            external_identifier=self.external_identifier,
        )

        service = self._create_service()
        result = service.check()

        assert result.allowed is False
        assert result.denial_reason == PreflightDenialReason.BILLING_QUOTA_EXCEEDED

"""
