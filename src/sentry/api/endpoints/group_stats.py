from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group


class GroupStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        data = tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            **self._parse_args(request)
        )[group.id]

        return Response(data)
