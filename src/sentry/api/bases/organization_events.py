from __future__ import absolute_import

from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)
        try:
            return get_snuba_query_args(query=request.GET.get('query'), params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)
