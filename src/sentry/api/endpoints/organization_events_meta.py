from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.utils import snuba


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args(request, organization, params)
        except OrganizationEventsError as exc:
            return Response({"detail": exc.message}, status=400)
        except NoProjects:
            return Response({"count": 0})

        data = snuba.transform_aliases_and_query(
            aggregations=[["count()", "", "count"]],
            referrer="api.organization-event-meta",
            **snuba_args
        )["data"][0]

        return Response({"count": data["count"]})
