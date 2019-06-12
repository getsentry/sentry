from __future__ import absolute_import

import six

from collections import OrderedDict
from datetime import timedelta
from functools import partial

from rest_framework.response import Response

from sentry import tagstore
from sentry.tagstore.types import TagKey, TagValue
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
from sentry.models.project import Project

ALLOWED_GROUPINGS = frozenset(('issue.id', 'project.id'))


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
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args_v2(request, organization, params)

            fields = snuba_args.get('selected_columns')
            groupby = snuba_args.get('groupby', [])

            if not fields and not groupby:
                return Response({'detail': 'No fields or groupings provided'}, status=400)

            if any(field for field in groupby if field not in ALLOWED_GROUPINGS):
                message = ('Invalid groupby value requested. Allowed values are ' +
                           ', '.join(ALLOWED_GROUPINGS))
                return Response({'detail': message}, status=400)

        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response([])

        filters = snuba_args.get('filter_keys', {})
        has_global_views = features.has(
            'organizations:global-views',
            organization,
            actor=request.user)
        if not has_global_views and len(filters.get('project_id', [])) > 1:
            return Response({
                'detail': 'You cannot view events from multiple projects.'
            }, status=400)

        data_fn = partial(
            lambda **kwargs: transform_aliases_and_query(
                skip_conditions=True, **kwargs)['data'],
            referrer='api.organization-events-v2',
            **snuba_args
        )

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda results: self.handle_results(
                request, organization, params['project_id'], results),
        )

    def handle_results(self, request, organization, project_ids, results):
        projects = {p['id']: p['slug'] for p in Project.objects.filter(
            organization=organization,
            id__in=project_ids).values('id', 'slug')}

        fields = request.GET.getlist('field')

        if 'project.name' in fields:
            for result in results:
                result['project.name'] = projects[result['project.id']]
                if 'project.id' not in fields:
                    del result['project.id']

        return results


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


class OrganizationEventsHeatmapEndpoint(OrganizationEventsEndpointBase):
    NON_TAG_KEYS = frozenset(['project.name'])

    def get(self, request, organization):
        try:
            snuba_args = self.get_snuba_query_args(request, organization)
        except OrganizationEventsError as exc:
            return Response({'detail': exc.message}, status=400)
        except NoProjects:
            return Response({'detail': 'A valid project must be included.'}, status=400)

        lookup_keys = []
        non_tag_lookup_keys = []
        for key in request.GET.getlist('keys'):
            if key in self.NON_TAG_KEYS:
                non_tag_lookup_keys.append(key)
            lookup_keys.append(tagstore.prefix_reserved_key(key))

        if not lookup_keys:
            return Response({'detail': 'Tag keys must be specified.'}, status=400)
        project_ids = snuba_args['filter_keys']['project_id']
        environment_ids = snuba_args['filter_keys'].get('environment_id')

        has_global_views = features.has(
            'organizations:global-views',
            organization,
            actor=request.user)

        if not has_global_views and len(project_ids) > 1:
            return Response({
                'detail': 'You cannot view events from multiple projects.'
            }, status=400)

        try:
            top_values_by_key = tagstore.get_top_values_by_keys(
                project_ids, None, environment_ids, keys=lookup_keys, get_excluded_tags=True, **snuba_args)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        if non_tag_lookup_keys:
            self.handle_non_tag_keys(non_tag_lookup_keys, snuba_args, top_values_by_key)

        tag_keys = self._create_tag_objects(top_values_by_key)
        return Response(serialize(tag_keys, request.user))

    def handle_non_tag_keys(self, keys, snuba_args, top_values_by_key):
        result = set([])
        for key in keys:
            values_dict = OrderedDict()

            if key == 'project.name':
                data = self._query_non_tag_data('project_id', snuba_args)
                projects = Project.objects.filter(id__in=snuba_args['filter_keys']['project_id'])
                for value in data:
                    project_slug = projects.filter(id=value['project_id'])[0].slug
                    values_dict[project_slug] = value

            top_values_by_key[key] = values_dict
        return result

    def _query_non_tag_data(self, key, snuba_args):
        data = raw_query(
            groupby=[key],
            aggregations=snuba_args.get('aggregations', []) + [
                ['count()', '', 'count'],
                ['min', 'timestamp', 'first_seen'],
                ['max', 'timestamp', 'last_seen'],
            ],
            orderby='-count',
            referrer='api.organization-events-heatmap',
            **snuba_args
        )['data']
        return data

    def _create_tag_objects(self, top_values_by_key):
        tag_keys = []
        for key, top_values in six.iteritems(top_values_by_key):
            tag_key = TagKey(key=key, top_values=[], values_seen=len(top_values))
            total_count = 0
            for value_key, value_data in six.iteritems(top_values):
                tag_key.top_values.append(
                    TagValue(
                        key=key,
                        value=value_key,
                        times_seen=value_data['count'],
                        first_seen=value_data['first_seen'],
                        last_seen=value_data['last_seen'],
                    )
                )
                total_count += value_data['count']
            tag_key.count = total_count
            tag_keys.append(tag_key)
        return tag_keys


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
