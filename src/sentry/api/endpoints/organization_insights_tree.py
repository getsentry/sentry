import logging
import re

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationInsightsTreeEndpoint(OrganizationEventsEndpoint):
    """
    Endpoint for querying Next.js Insights data to display a tree view of files and components.

    Currently, the component and path information is extracted from the span.description field using a regex.
    In the future, this data will be properly structured through:
    1. The Next.js SDK adding these as explicit attributes
    2. EAP adding support for array data storage and querying

    These improvements will enable more efficient querying and level-by-level tree navigation.
    This endpoint is temporary and will be replaced by the standard /events/ endpoint once
    these features are implemented elsewhere in the system.
    """

    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)

        if not request.GET.get("noPagination", False):
            return Response(status=404)

        response = super().get(request, organization)
        return self._separate_span_description_info(response)

    def _separate_span_description_info(self, response):
        # Regex to split string into '{component_type}{space}({path})'
        pattern = re.compile(r"^(.*?)\s+\((.*?)\)$")

        for line in response.data["data"]:
            match = pattern.match(line["span.description"])
            if match:
                component_type = match.group(1)
                path = match.group(2)
                path_components = path.strip("/").split("/")
                if not path_components or (len(path_components) == 1 and path_components[0] == ""):
                    path_components = []  # Handle root path case

            else:
                component_type = None
                path_components = []
            line["function.nextjs.component_type"] = component_type
            line["function.nextjs.path"] = path_components

        return response
