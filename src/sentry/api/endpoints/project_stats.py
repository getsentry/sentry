from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Project
from sentry.tsdb.base import TSDBModel


class ProjectStatsEndpoint(Endpoint):
    def get(self, request, project_id):
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user)

        days = min(int(request.GET.get('days', 1)), 30)

        end = timezone.now()
        start = end - timedelta(days=1)

        data = tsdb.get_range(TSDBModel.project, [project.id], start, end)[project.id]

        return Response(data)
