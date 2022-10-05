from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.incident import IncidentEndpoint, IncidentPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.incidents.logic import get_incident_activity


@region_silo_endpoint
class OrganizationIncidentActivityIndexEndpoint(IncidentEndpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request: Request, organization, incident) -> Response:
        if request.GET.get("desc", "1") == "1":
            order_by = "-date_added"
        else:
            order_by = "date_added"

        return self.paginate(
            request=request,
            queryset=get_incident_activity(incident),
            order_by=order_by,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
