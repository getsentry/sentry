from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Environment


class GroupTagsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):

        # optional queryparam `key` can be used to get results
        # only for specific keys.
        keys = [tagstore.prefix_reserved_key(k)
                for k in request.GET.getlist('key') if k] or None

        # There are 2 use-cases for this method. For the 'Tags' tab we
        # get the top 10 values, for the tag distribution bars we get 9
        # This should ideally just be specified by the client
        if keys:
            value_limit = 9
        else:
            value_limit = 10

        try:
            environment_id = self._get_environment_id_from_request(
                request, group.project.organization_id)
        except Environment.DoesNotExist:
            tag_keys = []
        else:
            tag_keys = tagstore.get_group_tag_keys_and_top_values(
                group.project_id, group.id, environment_id, keys=keys,
                value_limit=value_limit)

        return Response(serialize(tag_keys, request.user))
