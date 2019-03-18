from __future__ import absolute_import

from collections import namedtuple
from datetime import timedelta
from functools import partial

from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize, SimpleEventSerializer
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.models import SnubaEvent
from sentry.utils.dates import parse_stats_period
from sentry.utils.snuba import raw_query
from sentry.utils.validators import is_event_id
from sentry.api.event_search import get_snuba_query_args

SnubaTSResult = namedtuple('SnubaTSResult', ('data', 'start', 'end', 'rollup'))


class OrganizationEventsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        # Check for a direct hit on event ID
        query = request.GET.get('query', '').strip()
        if is_event_id(query):
            try:
                snuba_args = get_snuba_query_args(
                    query=u'id:{}'.format(query),
                    params=self.get_filter_params(request, organization))

                results = raw_query(
                    selected_columns=SnubaEvent.selected_columns,
                    referrer='api.organization-events',
                    **snuba_args
                )['data']

                if len(results) == 1:
                    response = Response(
                        serialize([SnubaEvent(row) for row in results], request.user)
                    )
                    response['X-Sentry-Direct-Hit'] = '1'
                    return response
            except (OrganizationEventsError, NoProjects):
                pass

        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            # return empty result if org doesn't have projects
            # or user doesn't have access to projects in org
            data_fn = lambda *args, **kwargs: []
        else:
            data_fn = partial(
                # extract 'data' from raw_query result
                lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
                selected_columns=SnubaEvent.selected_columns,
                orderby='-timestamp',
                referrer='api.organization-events',
                **snuba_args
            )

        serializer = SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )


class OrganizationEventsStatsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response({'data': []})

        interval = parse_stats_period(request.GET.get('interval', '1h'))
        if interval is None:
            interval = timedelta(hours=1)

        rollup = int(interval.total_seconds())

        result = raw_query(
            aggregations=[
                ('count()', '', 'count'),
            ],
            orderby='time',
            groupby=['time'],
            rollup=rollup,
            referrer='api.organization-events-stats',
            limit=10000,
            **snuba_args
        )

        serializer = SnubaTSResultSerializer(organization, None, request.user)
        return Response(
            serializer.serialize(
                SnubaTSResult(result, snuba_args['start'], snuba_args['end'], rollup),
            ),
            status=200,
        )


class OrganizationEventsMetaEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response({'count': 0})

        data = raw_query(
            aggregations=[['count()', '', 'count']],
            referrer='api.organization-event-meta',
            turbo=True,
            **snuba_args
        )['data'][0]

        return Response({
            # this needs to be multiplied to account for the `TURBO_SAMPLE_RATE`
            # in snuba
            'count': data['count'] * 10,
        })
