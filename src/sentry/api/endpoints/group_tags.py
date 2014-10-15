from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import assert_perm
from sentry.models import Group, GroupTagValue, GroupTagKey, TagKey


class GroupTagsEndpoint(Endpoint):
    def get(self, request, group_id):
        group = Group.objects.get(
            id=group_id,
        )

        assert_perm(group, request.user, request.auth)

        def percent(total, this):
            return int(this / total * 100)

        tag_keys = TagKey.objects.filter(
            project=group.project,
            key__in=GroupTagKey.objects.filter(
                group=group,
            ).values('key'),
        )

        # O(N) db access
        data = []
        for tag_key in tag_keys:
            queryset = GroupTagValue.objects.filter(
                group=group,
                key=tag_key.key,
            )

            total_values = queryset.count()
            top_values = queryset.order_by('-times_seen')[:5]

            data.append({
                'id': tag_key.id,
                'key': tag_key.key,
                'name': tag_key.get_label(),
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
