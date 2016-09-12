from __future__ import absolute_import

from rest_framework.response import Response

from sentry import filters
from sentry.api.bases.project import ProjectEndpoint


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
