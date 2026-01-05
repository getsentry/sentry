from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sentry import features
from sentry.constants import ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT, HIDE_AI_FEATURES_DEFAULT
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewSettings, RepositorySettings

from .billing import passes_code_review_billing_check

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
        pr_author_external_id: str | None = None,
    ):
        self.organization = organization
        self.repo = repo
        self.integration_id = integration_id
        self.pr_author_external_id = pr_author_external_id

        repo_settings = RepositorySettings.objects.filter(repository=repo).first()
        self._repo_settings = repo_settings.get_code_review_settings() if repo_settings else None

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

        return CodeReviewPreflightResult(allowed=True, settings=self._repo_settings)

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
            if self._repo_settings is None or not self._repo_settings.enabled:
                return "repo_code_review_disabled"
            return None
        elif self._is_code_review_beta_org():
            # For beta orgs, all repos are considered enabled
            return None
        else:
            return "repo_code_review_disabled"

    def _check_billing(self) -> DenialReason:
        if self.integration_id is None or self.pr_author_external_id is None:
            return "billing_missing_contributor_info"

        billing_ok = passes_code_review_billing_check(
            organization_id=self.organization.id,
            integration_id=self.integration_id,
            external_identifier=self.pr_author_external_id,
        )
        if not billing_ok:
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
