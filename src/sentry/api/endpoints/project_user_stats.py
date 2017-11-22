from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Environment


class ProjectUserStatsEndpoint(EnvironmentMixin, ProjectEndpoint):
    def get(self, request, project):
        try:
            environment_id = self._get_environment_id_from_request(
                request,
                project.organization_id,
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        now = timezone.now()
        then = now - timedelta(days=30)

        # TODO(tkaemming): Rollup doesn't actually work correctly here
        results = tsdb.rollup(
            tsdb.get_distinct_counts_series(
                tsdb.models.users_affected_by_project,
                (project.id, ),
                then,
                now,
                environment_id=environment_id,
            ), 3600 * 24
        )[project.id]

        return Response(results)
