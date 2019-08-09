from __future__ import absolute_import

import logging
import six
from functools import partial
from rest_framework.response import Response

from sentry.api.bases import OrganizationEventsEndpointBase, OrganizationEventsError, NoProjects
from sentry.api.helpers.events import get_direct_hit_response
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry.models import SnubaEvent
from sentry.utils import snuba
from sentry import features
from sentry.models.project import Project

logger = logging.getLogger(__name__)


class OrganizationEventsEndpoint(OrganizationEventsEndpointBase):

    def get(self, request, organization):
        if not features.has('organizations:events-v2', organization, actor=request.user):
            return self.get_legacy(request, organization)

        try:
            params = self.get_filter_params(request, organization)
            snuba_args = self.get_snuba_query_args(request, organization, params)
            fields = snuba_args.get('selected_columns')
            if not fields:
                return Response({'detail': 'No fields provided'}, status=400)

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
            lambda **kwargs: snuba.transform_aliases_and_query(skip_conditions=True, **kwargs),
            referrer='api.organization-events-v2',
            **snuba_args
        )

        try:
            return self.paginate(
                request=request,
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                on_results=lambda results: self.handle_results_with_meta(
                    request, organization, params['project_id'], results),
            )
        except snuba.SnubaError as error:
            logger.info(
                'organization.events.snuba-error',
                extra={
                    'organization_id': organization.id,
                    'user_id': request.user.id,
                    'error': six.text_type(error),
                }
            )
            return Response({
                'detail': 'Invalid query.'
            }, status=400)

    def get_legacy(self, request, organization):
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
            snuba_args = self.get_snuba_query_args_legacy(request, organization)
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
                lambda *args, **kwargs: snuba.raw_query(*args, **kwargs)['data'],
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

    def handle_results_with_meta(self, request, organization, project_ids, results):
        data = self.handle_results(request, organization, project_ids, results.get('data'))
        if not data:
            return {'data': [], 'meta': {}}

        meta = {value['name']: snuba.get_json_type(value['type']) for value in results['meta']}
        # Ensure all columns in the result have types.
        for key in data[0]:
            if key not in meta:
                meta[key] = 'string'
        return {
            'meta': meta,
            'data': data,
        }

    def handle_results(self, request, organization, project_ids, results):
        if not results:
            return results

        first_row = results[0]
        if not ('project.id' in first_row or 'projectid' in first_row):
            return results

        fields = request.GET.getlist('field')
        projects = {p['id']: p['slug'] for p in Project.objects.filter(
            organization=organization,
            id__in=project_ids).values('id', 'slug')}
        for result in results:
            for key in ('projectid', 'project.id'):
                if key in result:
                    result['project.name'] = projects[result[key]]
                    if key not in fields:
                        del result[key]

        return results
