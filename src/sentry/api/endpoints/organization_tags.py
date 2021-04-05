from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases import NoProjects, OrganizationEventsEndpointBase
from sentry.api.serializers import serialize


class OrganizationTagsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            filter_params = self.get_filter_params(request, organization)
        except NoProjects:
            return Response([])

        with self.handle_query_errors():
            results = tagstore.get_tag_keys_for_projects(
                filter_params["project_id"],
                filter_params.get("environment"),
                filter_params["start"],
                filter_params["end"],
                use_cache=request.GET.get("use_cache", "0") == "1",
            )

        return Response(serialize(results, request.user))
