from __future__ import absolute_import

import six

from collections import defaultdict
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize


class GroupTagsEndpoint(GroupEndpoint):
    def get(self, request, group):
        grouptagkeys = [gtk.key for gtk in tagstore.get_group_tag_keys(group.id)]

        tag_keys = tagstore.get_tag_keys(group.project_id, grouptagkeys)

        # O(N) db access
        data = []
        all_top_values = []
        for tag_key in tag_keys:
            total_values = tagstore.get_group_tag_value_count(group.id, tag_key.key)
            top_values = tagstore.get_top_group_tag_values(group.id, tag_key.key, limit=10)

            all_top_values.extend(top_values)

            data.append(
                {
                    'id': six.text_type(tag_key.id),
                    'key': tagstore.get_standardized_key(tag_key.key),
                    'name': tag_key.get_label(),
                    'uniqueValues': tag_key.values_seen,
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
