from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.group import GroupEndpoint


class GroupStatsEndpoint(GroupEndpoint, StatsMixin):
    def get(self, request, group):
        data = tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            **self._parse_args(request)
        )[group.id]

        return Response(data)
