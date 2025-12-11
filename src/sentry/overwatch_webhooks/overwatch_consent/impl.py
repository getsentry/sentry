# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from sentry import features
from sentry.constants import ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT, HIDE_AI_FEATURES_DEFAULT
from sentry.models.organization import Organization
from sentry.overwatch_webhooks.overwatch_consent.model import RpcOrganizationConsentStatus
from sentry.overwatch_webhooks.overwatch_consent.service import OverwatchConsentService


class DatabaseBackedOverwatchConsentService(OverwatchConsentService):
    def get_organization_consent_status(
        self, *, organization_ids: list[int], region_name: str
    ) -> dict[int, RpcOrganizationConsentStatus]:
        """
        Get consent status for multiple organizations in a region.

        Consent is determined by the combination of 2 different organization option values:
        - sentry:hide_ai_features should be False (default)
        - sentry:enable_pr_review_test_generation should be True (default is False)
        """
        organizations = Organization.objects.filter(id__in=organization_ids)

        result: dict[int, RpcOrganizationConsentStatus] = {}

        for org in organizations:
            hide_ai_features = bool(
                org.get_option("sentry:hide_ai_features", HIDE_AI_FEATURES_DEFAULT)
            )
            if features.has("organizations:seat-based-seer-enabled", org):
                # Seat-based plan orgs don't need to check the PR review toggle
                has_consent = not hide_ai_features
            else:
                # Usage-based plan orgs and others need to check the PR review toggle
                pr_review_test_generation_enabled = bool(
                    org.get_option(
                        "sentry:enable_pr_review_test_generation",
                        ENABLE_PR_REVIEW_TEST_GENERATION_DEFAULT,
                    )
                )
                has_consent = not hide_ai_features and pr_review_test_generation_enabled

            result[org.id] = RpcOrganizationConsentStatus(
                organization_id=org.id,
                has_consent=has_consent,
            )

        return result
