from __future__ import absolute_import

from functools32 import partial

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError
from sentry.api.paginator import GenericOffsetPaginator
from sentry.utils.snuba import raw_query


class OrganizationTagsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='-count',
            groupby=['tags_key'],
            referrer='api.organization-tags',
            **snuba_args
        )

        return self.paginate(
            request=request,
            on_results=lambda results: [{
                'tag': row['tags_key'],
                'count': row['count'],
            } for row in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
