from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import TagKey


class GroupTagKeyStatsEndpoint(GroupEndpoint, StatsMixin):
    def get(self, request, group, key):
        # XXX(dcramer): kill sentry prefix for internal reserved tags
        if TagKey.is_reserved_key(key):
            lookup_key = 'sentry:{0}'.format(key)
        else:
            lookup_key = key

        if lookup_key == 'release':
            stat_model = tsdb.models.frequent_releases_by_groups
        else:
            raise ResourceDoesNotExist

        # fetch the top 5
        # TODO(dcramer): this needs a new endpoint as this doesnt return time
        # series data
        data = tsdb.get_most_frequent(
            model=stat_model,
            keys=[group.id],
            limit=5,
            **self._parse_args(request)
        )[group.id]

        # if there are 5 or 0, also fetch total counts so we can see what
        # "Other" is

        return Response(data)
