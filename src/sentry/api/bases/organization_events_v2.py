from __future__ import absolute_import

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery


class OrganizationEventsV2EndpointBase(OrganizationEndpoint):
    def get_snuba_query_args(self, request, organization):
        params = self.get_filter_params(request, organization)

        query = request.GET.get('query')
        try:
            snuba_args = get_snuba_query_args(query=query, params=params)
        except InvalidSearchQuery as exc:
            raise OrganizationEventsError(exc.message)

        fields = request.GET.getlist('fields')
        if fields:
            snuba_args['selected_columns'] = fields

        groupby = request.GET.getlist('groupby')
        if groupby:
            snuba_args['groupby'] = groupby

        orderby = request.GET.get('orderby')
        if orderby:
            snuba_args['orderby'] = orderby

        # TODO(lb): remove once boolean search is fully functional
        has_boolean_op_flag = features.has(
            'organizations:boolean-search',
            organization,
            actor=request.user
        )
        if snuba_args.pop('has_boolean_terms', False) and not has_boolean_op_flag:
            raise OrganizationEventsError(
                'Boolean search operator OR and AND not allowed in this search.')
        return snuba_args
