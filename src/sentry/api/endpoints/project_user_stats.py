from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.bases.project import ProjectEndpoint


class ProjectUserStatsEndpoint(ProjectEndpoint):
    def get(self, request, project):
        now = timezone.now()
        then = now - timedelta(days=30)

        results = tsdb.rollup(
            tsdb.get_distinct_counts_series(
                tsdb.models.users_affected_by_project,
                (project.id, ),
                then,
                now,
            ), 3600 * 24
        )[project.id]

        return Response(results)
