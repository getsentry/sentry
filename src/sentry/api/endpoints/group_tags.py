from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.models import Environment


class GroupTagsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        try:
            environment_id = self._get_environment_id_from_request(
                request, group.project.organization_id)
        except Environment.DoesNotExist:
            data = []
        else:
            data = tagstore.get_group_tag_keys_and_top_values(
                group.project_id, group.id, environment_id)

        return Response(data)
