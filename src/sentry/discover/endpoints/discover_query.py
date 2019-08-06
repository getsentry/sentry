from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models import Project, ProjectStatus
from sentry import features

from .serializers import DiscoverQuerySerializer
from ..logic import (
    build_query_v1,
    build_query_v2,
    execute_query_v1,
    execute_query_v2,
    handle_results
)


class DiscoverQueryPermission(OrganizationPermission):
    scope_map = {
        'POST': ['org:read', 'project:read'],
    }


class DiscoverQueryEndpoint(OrganizationEndpoint):
    permission_classes = (DiscoverQueryPermission, )

    def post(self, request, organization):
        has_discover = features.has('organizations:discover', organization, actor=request.user)
        has_events_v2 = features.has('organizations:events-v2', organization, actor=request.user)
        if not (has_discover or has_events_v2):
            return Response(status=404)

        requested_projects = request.data['projects']
        projects = list(Project.objects.filter(
            id__in=requested_projects,
            organization=organization,
            status=ProjectStatus.VISIBLE,
        ))

        has_invalid_projects = len(projects) < len(requested_projects)
        if has_invalid_projects or not request.access.has_projects_access(projects):
            return Response("Invalid projects", status=403)

        serializer = DiscoverQuerySerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data
        if has_discover:
            query_params = build_query_v1(serialized)
            data_fn = execute_query_v1(query_params)
        if has_events_v2:
            query_params = build_query_v2(serialized)
            data_fn = execute_query_v2(query_params)

        has_aggregations = len(query_params.get('aggregations')) > 0
        if has_aggregations:
            return self.paginate(
                request=request,
                on_results=lambda results: handle_results(results, query_params, projects),
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                max_per_page=1000
            )
        return Response(handle_results(
            data_fn(),
            query_params,
            projects
        ), status=200)
