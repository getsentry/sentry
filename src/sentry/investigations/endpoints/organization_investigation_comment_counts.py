from __future__ import annotations

from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.endpoints.base import OrganizationInvestigationEndpoint
from sentry.investigations.models import Investigation, InvestigationComment
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationCommentCountsEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        counts = (
            InvestigationComment.objects.filter(
                investigation=investigation,
                block__isnull=False,
                block__deleted_at__isnull=True,
            )
            .values_list("block_id")
            .annotate(count=Count("id"))
        )
        return Response({str(block_id): count for block_id, count in counts})
