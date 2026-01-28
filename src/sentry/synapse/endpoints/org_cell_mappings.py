from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.paginator import BadPaginationError, DateTimePaginator
from sentry.models.organizationmapping import OrganizationMapping
from sentry.synapse.endpoints.authentication import (
    SynapseAuthPermission,
    SynapseSignatureAuthentication,
)


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

    MAX_LIMIT = 1000

    def get(self, request: Request) -> Response:
        """
        Retrieve organization-to-cell mappings.
        """
        query = OrganizationMapping.objects.all()
        try:
            per_page = self.get_per_page(request, max_per_page=self.MAX_LIMIT)
            cursor = self.get_cursor_from_request(request)
            paginator = DateTimePaginator(
                queryset=query, order_by="-date_updated", max_limit=self.MAX_LIMIT
            )
            pagination_result = paginator.get_result(
                limit=per_page,
                cursor=cursor,
            )
        except BadPaginationError as e:
            raise ParseError(detail=str(e))

        mappings = {}
        for item in pagination_result.results:
            mappings[item.slug] = item.region_name
            mappings[str(item.organization_id)] = item.region_name

        response_data = {
            "data": mappings,
            "metadata": {
                "cursor": str(pagination_result.next),
                "has_more": pagination_result.next.has_results,
                "cell_to_locality": {
                    # TODO(cells) need to build this out with region/cell config data.
                    "us1": "us"
                },
            },
        }
        return Response(response_data, status=200)
