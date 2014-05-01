from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group
from sentry.tsdb.base import TSDBModel


class GroupStatsEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user)

        days = min(int(request.GET.get('days', 1)), 30)

        end = timezone.now()
        start = end - timedelta(days=days)

        data = tsdb.get_range(TSDBModel.group, [group.id], start, end)[group.id]

        return Response(data)
