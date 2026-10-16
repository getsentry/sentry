from __future__ import annotations

import logging
from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import quotas
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.autofix.utils import is_free_cohort_org
from sentry.seer.types import SetupAcknowledgementResponse
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class SeerSetupBillingResponse(TypedDict):
    hasAutofixQuota: bool
    hasScannerQuota: bool


class OrganizationSeerSetupCheckResponse(TypedDict):
    setupAcknowledgement: SetupAcknowledgementResponse
    hasFreeAutofixAccess: bool
    billing: SeerSetupBillingResponse


@extend_schema(tags=["Organizations"])
@cell_silo_endpoint
class OrganizationSeerSetupCheckEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
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

    @extend_schema(
        operation_id="getOrganizationSeerSetupCheck",
        summary="Check Seer Setup for an Organization",
        description=(
            "Check Seer consent acknowledgements, free-tier access, and available quotas. "
            "The setupAcknowledgement fields are always true for backward compatibility. "
            "Requests without an authenticated user (for example, organization auth tokens) "
            "receive a bare 400 response."
        ),
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "OrganizationSeerSetupCheckResponse", OrganizationSeerSetupCheckResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[OrganizationSeerSetupCheckResponse] | Response[None]:
        """
        Checks Seer product setup status for the organization including quotas and acknowledgements/consent.
        The setupAcknowledgement fields are always true for backward compatibility. Requests without
        an authenticated user (for example, organization auth tokens) receive a bare 400 response.
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

        body: OrganizationSeerSetupCheckResponse = {
            "setupAcknowledgement": {
                "orgHasAcknowledged": True,
                "userHasAcknowledged": True,
            },
            "hasFreeAutofixAccess": is_free_cohort_org(organization),
            "billing": {
                "hasAutofixQuota": has_autofix_quota,
                "hasScannerQuota": has_seer_scanner_quota,
            },
        }
        return Response(body)
