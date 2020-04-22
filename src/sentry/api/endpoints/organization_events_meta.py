from __future__ import absolute_import

import six

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.utils import snuba
from sentry.snuba import discover


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization):
        try:
            params = self.get_filter_params(request, organization)
        except OrganizationEventsError as e:
            return Response({"detail": six.text_type(e)}, status=400)
        except NoProjects:
            return Response({"count": 0})

        try:
            result = discover.query(
                selected_columns=["count()"],
                params=params,
                query=request.query_params.get("query"),
                referrer="api.organization-events-meta",
            )
        except (discover.InvalidSearchQuery, snuba.QueryOutsideRetentionError) as error:
            raise ParseError(detail=six.text_type(error))

        return Response({"count": result["data"][0]["count"]})
