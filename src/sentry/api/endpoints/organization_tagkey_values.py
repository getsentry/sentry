from __future__ import absolute_import

from functools32 import partial

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.api.paginator import GenericOffsetPaginator
from sentry.utils.snuba import raw_query, get_snuba_column_name
from sentry.tagstore.base import TAG_KEY_RE


class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization, key):
        if not TAG_KEY_RE.match(key):
            return Response({'detail': 'Invalid tag key format for "%s"' % (key,)}, status=400)

        try:
            filter_params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        column_name = get_snuba_column_name(key)
        # TODO: Make this work... we want column_name LIKE %query%
        # query = request.GET.get('query', '')

        try:
            snuba_args = get_snuba_query_args('', params=filter_params)
        except InvalidSearchQuery as exc:
            return Response({'detail': exc.message}, status=400)

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='-count',
            groupby=[column_name],
            referrer='api.organization-tags',
            selected_columns=[column_name],
            **snuba_args
        )

        return self.paginate(
            request=request,
            on_results=lambda results: [{
                'value': row[column_name],
                'count': row['count'],
            } for row in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
