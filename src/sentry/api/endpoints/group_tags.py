from __future__ import absolute_import

import six

from collections import defaultdict
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Environment


class GroupTagsEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request, group):
        try:
            environment_id = self._get_environment_id_from_request(
                request, group.project.organization_id)
        except Environment.DoesNotExist:
            group_tag_keys = []
        else:
            group_tag_keys = tagstore.get_group_tag_keys(group.project_id, group.id, environment_id)

        # O(N) db access
        data = []
        all_top_values = []
        for group_tag_key in group_tag_keys:
            total_values = tagstore.get_group_tag_value_count(
                group.project_id, group.id, environment_id, group_tag_key.key)
            top_values = tagstore.get_top_group_tag_values(
                group.project_id, group.id, environment_id, group_tag_key.key, limit=10)

            all_top_values.extend(top_values)

            data.append(
                {
                    'id': six.text_type(group_tag_key.id),
                    'key': tagstore.get_standardized_key(group_tag_key.key),
                    'name': tagstore.get_tag_key_label(group_tag_key.key),
                    'uniqueValues': group_tag_key.values_seen,
                    'totalValues': total_values,
                }
            )

        # Serialize all of the values at once to avoid O(n) serialize/db queries
        top_values_by_key = defaultdict(list)
        for value in serialize(all_top_values, request.user):
            top_values_by_key[value['key']].append(value)

        for d in data:
            d['topValues'] = top_values_by_key[d['key']]

        return Response(data)
