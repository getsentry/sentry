import logging
import re

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.endpoints.organization_events import OrganizationEventsEndpoint

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationInsightsTreeEndpoint(OrganizationEventsEndpoint):
    def get(self, request: Request, organization) -> Response:
        if not self.has_feature(organization, request):
            return Response(status=404)
        request["useRpc"] = True
        request["noPagination"] = True

        queryresult = super().get(request, organization)
        return self._separate_span_description_info(queryresult)

    def _separate_span_description_info(self, queryresult):
        # Regex to split string into '{component_type} {space} ({path})'
        pattern = re.compile(r"^(.*?)\s+\((.*?)\)$")
        for line in queryresult["data"]:
            match = pattern.match(line["span.description"])
            if match:
                component_type = match.group(1)
                path = match.group(2)
                path_components = path.strip("/").split("/")
                if not path_components or (len(path_components) == 1 and path_components[0] == ""):
                    path_components = ["/"]  # Handle root path case
            else:
                line["function.nextjs.component_type"] = None
                line["function.nextjs.path"] = None

            line["function.nextjs.component_type"] = component_type
            line["function.nextjs.path"] = path_components

        return queryresult
