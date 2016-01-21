from __future__ import absolute_import

from rest_framework.response import Response

from collections import defaultdict
from sentry.api.bases.group import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import GroupTagValue, GroupTagKey, TagKey, TagKeyStatus


class GroupTagsEndpoint(GroupEndpoint):
    def get(self, request, group):
        tag_keys = TagKey.objects.filter(
            project=group.project,
            status=TagKeyStatus.VISIBLE,
            key__in=GroupTagKey.objects.filter(
                group=group,
            ).values('key'),
        )

        # O(N) db access
        data = []
        all_top_values = []
        for tag_key in tag_keys:
            total_values = GroupTagValue.get_value_count(group.id, tag_key.key)
            top_values = GroupTagValue.get_top_values(group.id, tag_key.key, limit=10)

            all_top_values.extend(top_values)

            data.append({
                'id': str(tag_key.id),
                'key': TagKey.get_standardized_key(tag_key.key),
                'name': tag_key.get_label(),
                'uniqueValues': tag_key.values_seen,
                'totalValues': total_values,
            })

        # Serialize all of the values at once to avoid O(n) serialize/db queries
        top_values_by_key = defaultdict(list)
        for value in serialize(all_top_values, request.user):
            top_values_by_key[value['key']].append(value)

        for d in data:
            d['topValues'] = top_values_by_key[d['key']]

        return Response(data)
