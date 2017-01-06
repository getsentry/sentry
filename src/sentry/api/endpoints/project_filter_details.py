from __future__ import absolute_import

from rest_framework.response import Response

from sentry import filters
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist


class ProjectFilterDetailsEndpoint(ProjectEndpoint):
    def put(self, request, project, filter_id):
        """
        Update a filter

        Update a project's filter.

            {method} {path}

        """
        try:
            filter = filters.get(filter_id)(project)
        except filters.FilterNotRegistered:
            raise ResourceDoesNotExist

        serializer = filter.serializer_cls(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        filter.enable(serializer.object)

        return Response(status=201)
