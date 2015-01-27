from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Project


class ProjectStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, project_id):
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user, request.auth)

        data = tsdb.get_range(
            model=tsdb.models.project,
            keys=[project.id],
            **self._parse_args(request)
        )[project.id]

        return Response(data)
