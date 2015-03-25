from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.models import GroupTagValue, GroupTagKey, TagKey


class GroupTagsEndpoint(GroupEndpoint):
    def _get_top_values(self, group_id, key, num=5):
        cutoff = timezone.now() - timedelta(days=7)
        return GroupTagValue.objects.filter(
            group=group_id,
            key=key,
            last_seen__gte=cutoff,
        )[:num]

    def get(self, request, group):
        tag_keys = TagKey.objects.filter(
            project=group.project,
            key__in=GroupTagKey.objects.filter(
                group=group,
            ).values('key'),
        )

        # O(N) db access
        data = []
        for tag_key in tag_keys:
            total_values = GroupTagValue.get_value_count(group.id, tag_key.key)
            top_values = self._get_top_values(group.id, tag_key.key)

            data.append({
                'id': str(tag_key.id),
                'key': tag_key.key,
                'name': tag_key.get_label(),
                'uniqueValues': tag_key.values_seen,
                'totalValues': total_values,
                'topValues': [
                    {
                        'id': tag_value.id,
                        'value': tag_value.value,
                        'count': tag_value.times_seen,
                        'firstSeen': tag_value.first_seen,
                        'lastSeen': tag_value.last_seen,
                    } for tag_value in top_values
                ]
            })

        return Response(data)
