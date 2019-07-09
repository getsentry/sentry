from __future__ import absolute_import

from django.utils import timezone
from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.event_search import get_snuba_query_args
from sentry.models import SnubaEvent
from sentry.api.utils import MAX_STATS_PERIOD
from sentry.tracing.logic import transform_to_spans
from sentry.utils import snuba


class OrganizationTracePermission(OrganizationPermission):
    scope_map = {
        'GET': ['event:read', 'event:write', 'event:admin'],
    }


class OrganizationTraceDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationTracePermission, )

    def get(self, request, organization, trace_id):
        """
        Fetch all the events in a trace by trace_id

        :pparam string trace_id: The trace id to get transactions/events for.
        :auth: required
        """
        if not features.has('organizations:events-v2', organization, actor=request.user):
            raise ResourceDoesNotExist()

        projects = self.get_projects(request, organization)
        current_time = timezone.now()
        trace_query = {
            'trace': trace_id,
            'project_id': [p.id for p in projects],
        }
        snuba_query = get_snuba_query_args(params=trace_query)
        results = snuba.raw_query(
            selected_columns=SnubaEvent.selected_columns,
            start=current_time - MAX_STATS_PERIOD,
            end=current_time,
            orderby='-timestamp',
            referrer='api.organization-trace-details',
            **snuba_query
        )
        if not len(results['data']):
            raise ResourceDoesNotExist(detail='No trace with the provided id could be found')

        # We don't use a typical serializer here because we need
        # to flatten the event -> spans tree and the serializer apis
        # are not built for that kind of transformation.
        spans = transform_to_spans([SnubaEvent(row) for row in results['data']])
        return Response(spans)
