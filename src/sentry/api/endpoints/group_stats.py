from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import EnvironmentMixin, StatsMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Environment


class GroupStatsEndpoint(GroupEndpoint, EnvironmentMixin, StatsMixin):
    def get(self, request, group):
        try:
            environment_id = self._get_environment_id_from_request(
                request, group.project.organization_id
            )
        except Environment.DoesNotExist:
            raise ResourceDoesNotExist

        data = tsdb.get_range(
            model=tsdb.models.group, keys=[group.id], **self._parse_args(request, environment_id)
        )[group.id]

        return Response(data)
