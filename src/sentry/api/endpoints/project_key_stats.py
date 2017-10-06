from __future__ import absolute_import

import six

from collections import OrderedDict
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey


class ProjectKeyStatsEndpoint(ProjectEndpoint, StatsMixin):
    def get(self, request, project, key_id):
        try:
            key = ProjectKey.objects.get(
                project=project,
                public_key=key_id,
                roles=ProjectKey.roles.store,
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        stat_args = self._parse_args(request)

        stats = OrderedDict()
        for model, name in (
            (tsdb.models.key_total_received,
             'total'), (tsdb.models.key_total_blacklisted, 'filtered'),
            (tsdb.models.key_total_rejected, 'dropped'),
        ):
            result = tsdb.get_range(model=model, keys=[key.id], **stat_args)[key.id]
            for ts, count in result:
                stats.setdefault(int(ts), {})[name] = count

        return Response(
            [
                {
                    'ts': ts,
                    'total': data['total'],
                    'dropped': data['dropped'],
                    'filtered': data['filtered'],
                    'accepted': data['total'] - data['dropped'] - data['filtered'],
                } for ts, data in six.iteritems(stats)
            ]
        )
