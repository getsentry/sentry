from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group


class GroupStatsEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user)

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
        data = [(now - (n * TICK), random.randint(0, 500)) for n in range(NUM_TICKS + 1, 0, -1)]

        # data = Group.objects.get_chart_data_for_group(
        #     instances=[group],
        #     max_days=min(int(request.GET.get('days', 1)), 30),
        # )

        return Response(data)
