from __future__ import absolute_import

from functools32 import partial

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError
from sentry.api.event_search import get_snuba_query_args, InvalidSearchQuery
from sentry.api.paginator import GenericOffsetPaginator
from sentry.utils.snuba import raw_query, SENTRY_SNUBA_MAP
from sentry.tagstore.base import TAG_KEY_RE


class OrganizationTagKeyValuesEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization, key):
        if not TAG_KEY_RE.match(key):
            return Response({'detail': 'Invalid tag key format for "%s"' % (key,)}, status=400)

        try:
            filter_params = self.get_filter_params(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)

        # release is a weird tag
        if key == 'release':
            key = 'sentry:release'

        is_column = key in SENTRY_SNUBA_MAP

        if is_column:
            query = 'has:"%s"' % (key,)
        else:
            query = 'tags_key:"%s"' % (key,)

        try:
            snuba_args = get_snuba_query_args(query, params=filter_params)
        except InvalidSearchQuery as exc:
            return Response({'detail': exc.message}, status=400)

        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='-count',
            groupby=[SENTRY_SNUBA_MAP[key] if is_column else 'tags_value'],
            referrer='api.organization-tags',
            **snuba_args
        )

        return self.paginate(
            request=request,
            on_results=lambda results: [{
                'value': row[SENTRY_SNUBA_MAP[key] if is_column else 'tags_value'],
                'count': row['count'],
            } for row in results],
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )
