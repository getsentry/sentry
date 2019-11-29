from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.snuba import discover


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            return Response({"count": 0})

        result = discover.query(
            selected_columns=["count()"],
            params=params,
            query=request.query_params.get("query"),
            referrer="api.organization-events-meta",
        )

        return Response({"count": result["data"][0]["count"]})
