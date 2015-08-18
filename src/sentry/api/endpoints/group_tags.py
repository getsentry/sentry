from __future__ import absolute_import

from rest_framework.response import Response

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
        for tag_key in tag_keys:
            total_values = GroupTagValue.get_value_count(group.id, tag_key.key)
            top_values = GroupTagValue.get_top_values(group.id, tag_key.key, limit=10)
            if tag_key.key.startswith('sentry:'):
                key = tag_key.key.split('sentry:', 1)[-1]
            else:
                key = tag_key.key

            data.append({
                'id': str(tag_key.id),
                'key': key,
                'name': tag_key.get_label(),
                'uniqueValues': tag_key.values_seen,
                'totalValues': total_values,
                'topValues': serialize(top_values, request.user),
            })

        return Response(data)
