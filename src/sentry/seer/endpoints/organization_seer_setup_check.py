from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.seer_setup import get_seer_org_acknowledgement, get_seer_user_acknowledgement
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationSeerSetupCheckEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=200, window=60, concurrent_limit=20),
                RateLimitCategory.USER: RateLimit(limit=100, window=60, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=1000, window=60, concurrent_limit=100
                ),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Checks Seer product setup status for the organization including quotas and acknowledgements/consent.
        """
        if not request.user.is_authenticated:
            return Response(status=400)

        # Check quotas
        has_seer_scanner_quota: bool = quotas.backend.check_seer_quota(
            org_id=organization.id, data_category=DataCategory.SEER_SCANNER
        )
        has_autofix_quota: bool = quotas.backend.check_seer_quota(
            org_id=organization.id, data_category=DataCategory.SEER_AUTOFIX
        )

        # Check consent
        user_acknowledgement = get_seer_user_acknowledgement(
            user_id=request.user.id, organization=organization
        )
        org_acknowledgement = True
        if not user_acknowledgement:  # If the user has acknowledged, the org must have too.
            org_acknowledgement = get_seer_org_acknowledgement(organization)

        return Response(
            {
                "setupAcknowledgement": {
                    "orgHasAcknowledged": org_acknowledgement,
                    "userHasAcknowledged": user_acknowledgement,
                },
                "billing": {
                    "hasAutofixQuota": has_autofix_quota,
                    "hasScannerQuota": has_seer_scanner_quota,
                },
            }
        )
