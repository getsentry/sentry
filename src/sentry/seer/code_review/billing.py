from __future__ import annotations

from sentry import quotas
from sentry.constants import DataCategory
from sentry.models.organizationcontributors import OrganizationContributors
from sentry.utils import metrics


def passes_code_review_billing_check(
    organization_id: int,
    integration_id: int,
    external_identifier: str,
) -> bool:
    """
    Check if contributor exists, and if there's either a seat or quota available.
    NOTE: We explicitly check billing as the source of truth because if the contributor exists,
    then that means that they've opened a PR before, and either have a seat already OR it's their
    "Free action."

    Returns False if the billing check does not pass for code review feature.
    """
    try:
        contributor = OrganizationContributors.objects.get(
            organization_id=organization_id,
            integration_id=integration_id,
            external_identifier=external_identifier,
        )
    except OrganizationContributors.DoesNotExist:
        metrics.incr(
            "seer.code_review.error.contributor_not_found",
            tags={"organization_id": organization_id},
        )
        return False

    return quotas.backend.check_seer_quota(
        org_id=organization_id,
        data_category=DataCategory.SEER_USER,
        seat_object=contributor,
    )
