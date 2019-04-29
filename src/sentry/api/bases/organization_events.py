from __future__ import absolute_import

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import BOOLEAN_OPERATORS, get_snuba_query_args, InvalidSearchQuery


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)
        query = request.GET.get('query')

        # TODO(lb): remove once boolean search is fully functional
        if query:
            query_has_boolean_ops = [True for op in BOOLEAN_OPERATORS if op in query]
            if query_has_boolean_ops and not features.has(
                    'organizations:boolean-search', organization, actor=request.user):
                raise OrganizationEventsError(
                    'Boolean search operator OR and AND not allowed in this search.')

        try:
            return get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)
