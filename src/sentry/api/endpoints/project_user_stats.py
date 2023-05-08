from datetime import timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Environment


@region_silo_endpoint
class ProjectUserStatsEndpoint(EnvironmentMixin, ProjectEndpoint):
    def get(self, request: Request, project) -> Response:
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        now = timezone.now()
        then = now - timedelta(days=30)

        results = tsdb.get_distinct_counts_series(
            tsdb.models.users_affected_by_project,
            (project.id,),
            then,
            now,
            rollup=3600 * 24,
            environment_id=environment_id,
            tenant_ids={
                "organization_id": project.organization_id,
                "referrer": "api.project_user_stats",
            },
        )[project.id]

        return Response(results)
