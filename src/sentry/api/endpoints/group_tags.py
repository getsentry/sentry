from __future__ import absolute_import

from datetime import timedelta
from django.db import connections
from django.db.models import Sum
from django.utils import timezone
from rest_framework.response import Response

from sentry.api.bases.group import GroupEndpoint
from sentry.models import GroupTagValue, GroupTagKey, TagKey
from sentry.utils import db


class GroupTagsEndpoint(GroupEndpoint):
    def _get_value_count(self, group_id, key):
        if db.is_postgres():
            # This doesnt guarantee percentage is accurate, but it does ensure
            # that the query has a maximum cost
            cursor = connections['default'].cursor()
            cursor.execute("""
                SELECT SUM(t)
                FROM (
                    SELECT times_seen as t
                    FROM sentry_messagefiltervalue
                    WHERE group_id = %s
                    AND key = %s
                    AND last_seen > NOW() - INTERVAL '7 days'
                    LIMIT 10000
                ) as a
            """, [group_id, key])
            return cursor.fetchone()[0] or 0

        cutoff = timezone.now() - timedelta(days=7)
        return GroupTagValue.objects.filter(
            group=group_id,
            key=key,
            last_seen__gte=cutoff,
        ).aggregate(t=Sum('times_seen'))['t']

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
            total_values = self._get_value_count(group.id, tag_key.key)
            top_values = self._get_top_values(group.id, tag_key.key)

            data.append({
                'id': tag_key.id,
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
