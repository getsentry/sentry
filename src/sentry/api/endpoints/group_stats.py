from datetime import datetime, timedelta
from pytz import utc
from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group
from sentry.tsdb.base import ROLLUPS


class GroupStatsEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user)

        resolution = request.GET.get('resolution')
        if resolution:
            resolution = tsdb.parse_resolution(resolution)

            assert any(r for r in ROLLUPS if r[0] == resolution)

        end = request.GET.get('until')
        if end:
            end = datetime.fromtimestamp(float(end)).replace(tzinfo=utc)
        else:
            end = datetime.utcnow().replace(tzinfo=utc)

        start = request.GET.get('since')
        if start:
            start = datetime.fromtimestamp(float(start)).replace(tzinfo=utc)
        else:
            start = end - timedelta(days=1, seconds=-1)

        data = tsdb.get_range(
            model=tsdb.models.group,
            keys=[group.id],
            start=start,
            end=end,
            rollup=resolution,
        )[group.id]

        return Response(data)
