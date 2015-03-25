from __future__ import absolute_import

from collections import defaultdict
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.api.serializers import Serializer, register
from sentry.app import tsdb
from sentry.constants import TAG_LABELS
from sentry.models import (
    Group, GroupBookmark, GroupTagKey, GroupSeen, GroupStatus
)
from sentry.utils.db import attach_foreignkey
from sentry.utils.http import absolute_uri


@register(Group)
class GroupSerializer(Serializer):
    def get_attrs(self, item_list, user):
        attach_foreignkey(item_list, Group.project, ['team'])

        if user.is_authenticated() and item_list:
            bookmarks = set(GroupBookmark.objects.filter(
                user=user,
                group__in=item_list,
            ).values_list('group_id', flat=True))
            seen_groups = dict(GroupSeen.objects.filter(
                user=user,
                group__in=item_list,
            ).values_list('group_id', 'last_seen'))
        else:
            bookmarks = set()
            seen_groups = {}

        tag_counts = defaultdict(dict)
        tag_results = GroupTagKey.objects.filter(
            group__in=item_list,
        ).values_list('key', 'group', 'values_seen')
        for key, group_id, values_seen in tag_results:
            tag_counts[key][group_id] = values_seen

        # we need to compute stats at 1d (1h resolution), and 14d/30d (1 day res)
        group_ids = [g.id for g in item_list]
        now = timezone.now()
        hourly_stats = tsdb.get_range(
            model=tsdb.models.group,
            keys=group_ids,
            end=now,
            start=now - timedelta(days=1),
            rollup=3600,
        )
        daily_stats = tsdb.get_range(
            model=tsdb.models.group,
            keys=group_ids,
            end=now,
            start=now - timedelta(days=30),
            rollup=3600 * 24,
        )

        result = {}
        for item in item_list:
            active_date = item.active_at or item.last_seen

            tags = {}
            for key in tag_counts.iterkeys():
                label = TAG_LABELS.get(key, key.replace('_', ' ')).lower()
                try:
                    value = tag_counts[key].get(item.id, 0)
                except KeyError:
                    value = 0
                tags[key] = {
                    'label': label,
                    'count': value,
                }

            result[item] = {
                'is_bookmarked': item.id in bookmarks,
                'has_seen': seen_groups.get(item.id, active_date) > active_date,
                'tags': tags,
                'hourly_stats': hourly_stats[item.id],
                'daily_stats': daily_stats[item.id],
            }
        return result

    def serialize(self, obj, attrs, user):
        status = obj.get_status()
        if status == GroupStatus.RESOLVED:
            status_label = 'resolved'
        elif status == GroupStatus.MUTED:
            status_label = 'muted'
        else:
            status_label = 'unresolved'

        if obj.team:
            permalink = absolute_uri(reverse('sentry-group', args=[
                obj.organization.slug, obj.project.slug, obj.id]))
        else:
            permalink = None

        d = {
            'id': str(obj.id),
            'count': str(obj.times_seen),
            'title': obj.message_short,
            'culprit': obj.culprit,
            'permalink': permalink,
            'firstSeen': obj.first_seen,
            'lastSeen': obj.last_seen,
            'timeSpent': obj.avg_time_spent,
            'isResolved': obj.get_status() == GroupStatus.RESOLVED,
            'status': status_label,
            'isPublic': obj.is_public,
            # 'score': getattr(obj, 'sort_value', 0),
            'project': {
                'name': obj.project.name,
                'slug': obj.project.slug,
            },
            'stats': {
                '24h': attrs['hourly_stats'],
                '30d': attrs['daily_stats'],
            },
            'isBookmarked': attrs['is_bookmarked'],
            'hasSeen': attrs['has_seen'],
            'tags': attrs['tags'],
        }
        return d
