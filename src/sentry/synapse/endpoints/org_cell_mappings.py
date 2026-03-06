from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.models.organizationmapping import OrganizationMapping
from sentry.synapse.endpoints.authentication import (
    SynapseAuthPermission,
    SynapseSignatureAuthentication,
)
from sentry.synapse.paginator import SynapsePaginator
from sentry.types.region import get_global_directory


@control_silo_endpoint
class OrgCellMappingsEndpoint(Endpoint):
    """
    Returns the organization-to-cell mappings for all orgs in pages.
    Only accessible by the Synapse internal service via X-Synapse-Auth header.
    """

    owner = ApiOwner.INFRA_ENG
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (SynapseSignatureAuthentication,)
    permission_classes = (SynapseAuthPermission,)

    MAX_LIMIT = 10000

    def get(self, request: Request) -> Response:
        """
        Retrieve organization-to-cell mappings.
        """
        directory = get_global_directory()

        query = OrganizationMapping.objects.all()
        localities = request.GET.getlist("locality")
        if localities:
            cell_names = [
                r.name
                for locality in localities
                for r in directory.get_cells_for_locality(locality)
            ]
            query = query.filter(cell_name__in=cell_names)

        per_page = self.get_per_page(request, max_per_page=self.MAX_LIMIT)
        paginator = SynapsePaginator(
            queryset=query,
            id_field="id",
            timestamp_field="date_updated",
        )
        pagination_result = paginator.get_result(
            limit=per_page,
            cursor_str=request.GET.get("cursor"),
        )

        mappings = [
            {"id": str(item.organization_id), "slug": item.slug, "cell": item.region_name}
            for item in pagination_result.results
        ]

        cell_to_locality = {
            cell.name: loc.name
            for cell in directory.cells
            if (loc := directory.get_locality_for_cell(cell.name)) is not None
        }

        response_data = {
            "data": mappings,
            "metadata": {
                "cursor": pagination_result.next_cursor,
                "has_more": pagination_result.has_more,
                "cell_to_locality": cell_to_locality,
            },
        }
        return Response(response_data, status=200)
