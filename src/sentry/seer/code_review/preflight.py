from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from functools import cached_property

from sentry import features, quotas
from sentry.constants import (
    ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
    HIDE_AI_FEATURES_DEFAULT,
    DataCategory,
)
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repository import Repository
from sentry.models.repositorysettings import (
    CodeReviewSettings,
    CodeReviewTrigger,
    RepositorySettings,
)


class PreflightDenialReason(StrEnum):
    """Reasons why a preflight check denied code review."""

    ORG_LEGAL_AI_CONSENT_NOT_GRANTED = "org_legal_ai_consent_not_granted"
    ORG_PR_REVIEW_LEGACY_TOGGLE_DISABLED = "org_pr_review_legacy_toggle_disabled"
    ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW = "org_not_eligible_for_code_review"
    REPO_CODE_REVIEW_DISABLED = "repo_code_review_disabled"
    BILLING_MISSING_CONTRIBUTOR_INFO = "billing_missing_contributor_info"
    BILLING_QUOTA_EXCEEDED = "billing_quota_exceeded"
    ORG_CONTRIBUTOR_IS_BOT = "org_contributor_is_bot"
    ORG_CONTRIBUTOR_NOT_FOUND = "org_contributor_not_found"


@dataclass
class CodeReviewPreflightResult:
    allowed: bool
    settings: CodeReviewSettings | None = None
    denial_reason: PreflightDenialReason | None = None


class CodeReviewPreflightService:
    def __init__(
        self,
        organization: Organization,
        repo: Repository,
        integration_id: int | None = None,
        pr_author_external_id: str | None = None,
    ):
        self.organization = organization
        self.repo = repo
        self.integration_id = integration_id
        self.pr_author_external_id = pr_author_external_id

        repo_settings = RepositorySettings.objects.filter(repository=repo).first()
        self._repo_settings = repo_settings.get_code_review_settings() if repo_settings else None

    def check(self) -> CodeReviewPreflightResult:
        checks: list[Callable[[], PreflightDenialReason | None]] = [
            self._check_legal_ai_consent,
            self._check_org_feature_enablement,
            self._check_repo_feature_enablement,
            self._check_billing,
        ]

        for check in checks:
            denial_reason = check()
            if denial_reason is not None:
                return CodeReviewPreflightResult(allowed=False, denial_reason=denial_reason)

        settings: CodeReviewSettings | None = self._repo_settings
        if not self._is_seat_based_seer_plan_org and (
            self._is_code_review_beta_org or self._is_legacy_usage_based_seer_plan_org
        ):
            # For beta and legacy usage-based plan orgs, all repos are considered enabled for these default triggers
            # Seat-based orgs should use their actual repo settings, so they're excluded here
            settings = CodeReviewSettings(
                enabled=True,
                triggers=[
                    CodeReviewTrigger.ON_NEW_COMMIT,
                    CodeReviewTrigger.ON_READY_FOR_REVIEW,
                ],
            )

        return CodeReviewPreflightResult(allowed=True, settings=settings)

    # -------------------------------------------------------------------------
    # Checks - each returns denial reason or None if valid
    # -------------------------------------------------------------------------

    def _check_legal_ai_consent(self) -> PreflightDenialReason | None:
        has_gen_ai_flag = features.has("organizations:gen-ai-features", self.organization)
        has_hidden_ai = self.organization.get_option(
            "sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT
        )

        if not has_gen_ai_flag or has_hidden_ai:
            return PreflightDenialReason.ORG_LEGAL_AI_CONSENT_NOT_GRANTED
        return None

    def _check_org_feature_enablement(self) -> PreflightDenialReason | None:
        # Seat-based orgs are always eligible
        if self._is_seat_based_seer_plan_org:
            return None

        # Beta orgs and those in the legacy usage-based plan need the legacy toggle enabled
        if self._is_code_review_beta_org or self._is_legacy_usage_based_seer_plan_org:
            if self._has_legacy_toggle_enabled:
                return None
            return PreflightDenialReason.ORG_PR_REVIEW_LEGACY_TOGGLE_DISABLED

        return PreflightDenialReason.ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW

    def _check_repo_feature_enablement(self) -> PreflightDenialReason | None:
        if self._is_seat_based_seer_plan_org:
            if self._repo_settings is None or not self._repo_settings.enabled:
                return PreflightDenialReason.REPO_CODE_REVIEW_DISABLED
            return None
        elif self._is_code_review_beta_org or self._is_legacy_usage_based_seer_plan_org:
            # For beta and legacy usage-based plan orgs, all repos are considered enabled
            return None
        else:
            return PreflightDenialReason.REPO_CODE_REVIEW_DISABLED

    def _check_billing(self) -> PreflightDenialReason | None:
        """
        Check if contributor exists and is not a bot, and if there's either a seat or quota available.
        NOTE: We explicitly check billing as the source of truth because if the contributor exists,
        then that means that they've opened a PR before, and either have a seat already OR it's their
        "Free action."
        """
        if self.integration_id is None or self.pr_author_external_id is None:
            return PreflightDenialReason.BILLING_MISSING_CONTRIBUTOR_INFO

        try:
            contributor = OrganizationContributors.objects.get(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
                external_identifier=self.pr_author_external_id,
            )
        except OrganizationContributors.DoesNotExist:
            return PreflightDenialReason.ORG_CONTRIBUTOR_NOT_FOUND

        # Bot check applies to all organization types
        if contributor.is_bot:
            return PreflightDenialReason.ORG_CONTRIBUTOR_IS_BOT

        # Code review beta and legacy usage-based plan orgs are exempt from quota checks
        # as long as they haven't purchased the new seat-based plan
        if not self._is_seat_based_seer_plan_org and (
            self._is_code_review_beta_org or self._is_legacy_usage_based_seer_plan_org
        ):
            return None

        has_quota = quotas.backend.check_seer_quota(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_USER,
            seat_object=contributor,
        )
        if not has_quota:
            return PreflightDenialReason.BILLING_QUOTA_EXCEEDED

        return None

    # -------------------------------------------------------------------------
    # Org type helpers
    # -------------------------------------------------------------------------

    @cached_property
    def _is_seat_based_seer_plan_org(self) -> bool:
        return features.has("organizations:seat-based-seer-enabled", self.organization)

    @cached_property
    def _is_code_review_beta_org(self) -> bool:
        return features.has("organizations:code-review-beta", self.organization)

    @cached_property
    def _is_legacy_usage_based_seer_plan_org(self) -> bool:
        return features.has("organizations:seer-added", self.organization)

    @cached_property
    def _has_legacy_toggle_enabled(self) -> bool:
        return bool(
            self.organization.get_option(
                "sentry:enable_pr_review_test_generation",
                ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
            )
        )
