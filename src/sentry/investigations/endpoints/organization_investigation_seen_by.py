from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import serialize
from sentry.investigations.endpoints.base import OrganizationInvestigationEndpoint
from sentry.investigations.endpoints.serializers.seen import InvestigationSeenSerializer
from sentry.investigations.models import Investigation, InvestigationSeen
from sentry.models.organization import Organization


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationSeenByEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self, request: Request, organization: Organization, investigation: Investigation
    ) -> Response:
        """Users who have opened the investigation, most recent first."""
        return self.paginate(
            request=request,
            queryset=InvestigationSeen.objects.filter(investigation=investigation),
            paginator_cls=DateTimePaginator,
            order_by="-last_seen",
            on_results=lambda results: [
                viewer
                for viewer in serialize(list(results), request.user, InvestigationSeenSerializer())
                if viewer is not None
            ],
        )
