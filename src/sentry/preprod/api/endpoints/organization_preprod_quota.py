from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization
from sentry.preprod.quotas import has_installable_quota, has_size_quota


@region_silo_endpoint
class OrganizationPreprodQuotaEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization) -> Response:
        return Response(
            {
                "hasSizeQuota": has_size_quota(organization, request.user),
                "hasDistributionQuota": has_installable_quota(organization, request.user),
            }
        )
