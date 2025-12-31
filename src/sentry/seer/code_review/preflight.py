from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sentry import features, quotas
from sentry.constants import (
    ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
    HIDE_AI_FEATURES_DEFAULT,
    DataCategory,
)
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.models.repository import Repository

from .settings import CodeReviewSettings, get_code_review_settings

DenialReason = str | None


@dataclass
class CodeReviewPreflightResult:
    allowed: bool
    settings: CodeReviewSettings | None = None
    denial_reason: DenialReason = None


class CodeReviewPreflightService:
    def __init__(
        self,
        organization: Organization,
        repo: Repository,
        integration_id: int | None = None,
        external_identifier: str | None = None,
    ):
        self.organization = organization
        self.repo = repo
        self.integration_id = integration_id
        self.external_identifier = external_identifier
        self._repo_settings: CodeReviewSettings | None = None
        self._repo_settings_loaded = False

    def check(self) -> CodeReviewPreflightResult:
        checks: list[Callable[[], DenialReason]] = [
            self._check_legal_ai_consent,
            self._check_org_feature_enablement,
            self._check_repo_feature_enablement,
            self._check_billing,
        ]

        for check in checks:
            denial_reason = check()
            if denial_reason is not None:
                return CodeReviewPreflightResult(allowed=False, denial_reason=denial_reason)

        return CodeReviewPreflightResult(allowed=True, settings=self._get_repo_settings())

    def _get_repo_settings(self) -> CodeReviewSettings | None:
        if not self._repo_settings_loaded:
            self._repo_settings = get_code_review_settings(self.repo)
            self._repo_settings_loaded = True
        return self._repo_settings

    # -------------------------------------------------------------------------
    # Checks - each returns denial reason (str) or None if valid
    # -------------------------------------------------------------------------

    def _check_legal_ai_consent(self) -> DenialReason:
        has_gen_ai_flag = features.has("organizations:gen-ai-features", self.organization)
        has_hidden_ai = self.organization.get_option(
            "sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT
        )

        if not has_gen_ai_flag or has_hidden_ai:
            return "org_legal_ai_consent_not_granted"
        return None

    def _check_org_feature_enablement(self) -> DenialReason:
        # Seat-based orgs are always eligible
        if self._is_seat_based_seer_plan_org():
            return None

        # Beta orgs need the legacy toggle enabled
        if self._is_code_review_beta_org():
            if self._has_legacy_toggle_enabled():
                return None
            return "org_pr_review_legacy_toggle_disabled"

        return "org_not_eligible_for_code_review"

    def _check_repo_feature_enablement(self) -> DenialReason:
        if self._is_seat_based_seer_plan_org():
            settings = self._get_repo_settings()
            if settings is None or not settings.enabled:
                return "repo_code_review_disabled"
            return None
        elif self._is_code_review_beta_org():
            # For beta orgs, all repos are considered enabled
            return None
        else:
            return "repo_code_review_disabled"

    def _check_billing(self) -> DenialReason:
        # Check if contributor exists, and if there's either a seat or quota available.
        # NOTE: We explicitly check billing as the source of truth because if the contributor exists,
        # then that means that they've opened a PR before, and either have a seat already OR it's their
        # "Free action."
        if self.integration_id is None or self.external_identifier is None:
            return "billing_missing_contributor_info"

        try:
            contributor = OrganizationContributors.objects.get(
                organization_id=self.organization.id,
                integration_id=self.integration_id,
                external_identifier=self.external_identifier,
            )
        except OrganizationContributors.DoesNotExist:
            return "billing_contributor_not_found"

        has_quota = quotas.backend.check_seer_quota(
            org_id=self.organization.id,
            data_category=DataCategory.SEER_USER,
            seat_object=contributor,
        )
        if not has_quota:
            return "billing_quota_exceeded"

        return None

    # -------------------------------------------------------------------------
    # Org type helpers
    # -------------------------------------------------------------------------

    def _is_seat_based_seer_plan_org(self) -> bool:
        return features.has("organizations:seat-based-seer-enabled", self.organization)

    def _is_code_review_beta_org(self) -> bool:
        # TODO: Remove the has_legacy_opt_in check once the beta list is frozen
        has_beta_flag = features.has("organizations:code-review-beta", self.organization)
        has_legacy_opt_in = self.organization.get_option(
            "sentry:enable_pr_review_test_generation", False
        )
        return has_beta_flag or bool(has_legacy_opt_in)

    def _has_legacy_toggle_enabled(self) -> bool:
        return bool(
            self.organization.get_option(
                "sentry:enable_pr_review_test_generation",
                ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
            )
        )
