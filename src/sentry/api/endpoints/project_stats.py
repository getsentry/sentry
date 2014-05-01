from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Project


class ProjectStatsEndpoint(Endpoint):
    def get(self, request, project_id):
        project = Project.objects.get(
            id=project_id,
        )

        assert_perm(project, request.user)

        days = min(int(request.GET.get('days', 1)), 30)

        import random
        import time
        now = int(time.time())
        if days == 1:
            TICK = 60 * 60
            NUM_TICKS = 24
        else:
            TICK = 60 * 60 * 24
            NUM_TICKS = days
        data = [(now - (n * TICK), random.randint(0, 500)) for n in range(NUM_TICKS, 0, -1)]

        # data = Project.objects.get_chart_data(
        #     instances=project,
        #     max_days=min(int(request.GET.get('days', 1)), 30),
        # )

        return Response(data)
