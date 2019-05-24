from __future__ import absolute_import

from datetime import timedelta
from functools import partial

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.events import get_direct_hit_response
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry.api.serializers.snuba import SnubaTSResultSerializer
from sentry.models import SnubaEvent
from sentry.utils.dates import parse_stats_period
from sentry.utils.snuba import (
    raw_query,
    transform_aliases_and_query,
    SnubaTSResult,
)
from sentry import features


class OrganizationEventsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        if features.has('organizations:events-v2', organization, actor=request.user):
            return self.get_v2(request, organization)

        # Check for a direct hit on event ID
        query = request.GET.get('query', '').strip()

        try:
            direct_hit_resp = get_direct_hit_response(
                request,
                query,
                self.get_filter_params(request, organization),
                'api.organization-events'
            )
        except (OrganizationEventsError, NoProjects):
            pass
        else:
            if direct_hit_resp:
                return direct_hit_resp

        full = request.GET.get('full', False)
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            # return empty result if org doesn't have projects
            # or user doesn't have access to projects in org
            data_fn = lambda *args, **kwargs: []
        else:
            snuba_cols = SnubaEvent.minimal_columns if full else SnubaEvent.selected_columns
            data_fn = partial(
                # extract 'data' from raw_query result
                lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
                selected_columns=snuba_cols,
                orderby='-timestamp',
                referrer='api.organization-events',
                **snuba_args
            )

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )

    def get_v2(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args_v2(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response([])
        else:
            data_fn = partial(
                lambda *args, **kwargs: transform_aliases_and_query(*args, **kwargs)['data'],
                referrer='api.organization-events-v2',
                **snuba_args
            )

            return self.paginate(
                request=request,
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

        y_axis = request.GET.get('yAxis', None)
        if not y_axis or y_axis == 'event_count':
            aggregations = [('count()', '', 'count')]
        elif y_axis == 'user_count':
            aggregations = [
                ('uniq', 'tags[sentry:user]', 'count'),
            ]
            snuba_args['filter_keys']['tags_key'] = ['sentry:user']
        else:
            return Response(
                {'detail': 'Param yAxis value %s not recognized.' % y_axis}, status=400)

        result = raw_query(
            aggregations=aggregations,
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


class OrganizationEventsTagsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, key):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response({'detail': 'A valid project must be included.'}, status=400)

        lookup_key = tagstore.prefix_reserved_key(key)
        project_ids = snuba_args['filter_keys']['project_id']
        environment_ids = snuba_args['filter_keys'].get('environment_id')
        aggregations = snuba_args.get('aggregations')
        conditions = snuba_args.get('conditions')
        try:
            tag_key = tagstore.get_tag_key(
                project_ids, environment_ids, lookup_key, conditions=conditions, aggregations=aggregations)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        return Response(serialize(tag_key, request.user))


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
