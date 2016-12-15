from __future__ import absolute_import

from rest_framework.response import Response

from sentry import filters
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from .project_filter_details import ProjectFilterSerializer


class ProjectFiltersEndpoint(ProjectEndpoint):
    def get(self, request, project):
        """
        List a project's filters

        Retrieve a list of filters for a given project.

            {method} {path}

        """
        results = []
        for f_cls in filters.all():
            filter = f_cls(project)
            results.append({
                'id': filter.id,
                'active': filter.is_enabled(),
                'description': filter.description,
                'name': filter.name,
            })

        results.sort(key=lambda x: x['name'])
        return Response(results)

    def put(self, request, project):
        filter_ids = request.GET.getlist('id')
        if filter_ids:
            for filter_id in filter_ids:
                try:
                    filter = filters.get(filter_id)(project)
                except filters.FilterNotRegistered:
                    raise ResourceDoesNotExist

                serializer = ProjectFilterSerializer(data=request.DATA, partial=True)
                if not serializer.is_valid():
                    return Response(serializer.errors, status=400)

                if 'active' in serializer.object:
                    filter.enable(serializer.object['active'])
        return Response(status=201)
