from __future__ import absolute_import

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import has_boolean_search_terms, get_snuba_query_args, InvalidSearchQuery


class OrganizationEventsEndpointBase(OrganizationEndpoint):

    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)
        query = request.GET.get('query')

        # TODO(lb): remove once boolean search is fully functional
        if query:
            has_boolean_op_flag = features.has(
                'organizations:boolean-search',
                organization,
                actor=request.user
            )
            if has_boolean_search_terms and not has_boolean_op_flag:
                raise OrganizationEventsError(
                    'Boolean search operator OR and AND not allowed in this search.')

        try:
            return get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)
