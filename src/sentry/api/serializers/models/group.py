from __future__ import absolute_import, print_function

from collections import defaultdict
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.api.serializers import Serializer, register, serialize
from sentry.app import tsdb
from sentry.models import (
    Group, GroupAssignee, GroupBookmark, GroupMeta, GroupTagKey, GroupSeen,
    GroupStatus, TagKey
)
from sentry.utils.db import attach_foreignkey
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute


@register(Group)
class GroupSerializer(Serializer):
    def get_attrs(self, item_list, user):
        from sentry.plugins import plugins

        GroupMeta.objects.populate_cache(item_list)

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

        assignees = dict(
            (a.group_id, a.user)
            for a in GroupAssignee.objects.filter(
                group__in=item_list,
            ).select_related('user')
        )

        tagkeys = dict(
            (t.key, t)
            for t in TagKey.objects.filter(
                project=item_list[0].project,
                key__in=tag_counts.keys(),
            )
        )

        result = {}
        for item in item_list:
            active_date = item.active_at or item.last_seen

            tags = {}
            for key in tag_counts.iterkeys():
                # TODO(dcramer): query for these
                tagkey = tagkeys[key]
                try:
                    value = tag_counts[key].get(item.id, 0)
                except KeyError:
                    value = 0
                tags[key] = {
                    'name': tagkey.get_label(),
                    'count': value,
                }

            annotations = []
            for plugin in plugins.for_project(project=item.project, version=1):
                safe_execute(plugin.tags, None, item, annotations)
            for plugin in plugins.for_project(project=item.project, version=2):
                annotations.extend(safe_execute(plugin.get_annotations, item) or ())

            result[item] = {
                'assigned_to': serialize(assignees.get(item.id)),
                'is_bookmarked': item.id in bookmarks,
                'has_seen': seen_groups.get(item.id, active_date) > active_date,
                'tags': tags,
                'annotations': annotations,
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
            'shareId': obj.get_share_id(),
            'count': str(obj.times_seen),
            'title': obj.message_short,
            'culprit': obj.culprit,
            'permalink': permalink,
            'firstSeen': obj.first_seen,
            'lastSeen': obj.last_seen,
            'timeSpent': obj.avg_time_spent,
            'level': obj.get_level_display(),
            'status': status_label,
            'isPublic': obj.is_public,
            'project': {
                'name': obj.project.name,
                'slug': obj.project.slug,
            },
            'numComments': obj.num_comments,
            'assignedTo': attrs['assigned_to'],
            'isBookmarked': attrs['is_bookmarked'],
            'hasSeen': attrs['has_seen'],
            'tags': attrs['tags'],
            'annotations': attrs['annotations'],
        }
        return d


class StreamGroupSerializer(GroupSerializer):
    def __init__(self, stats_period=None):
        self.stats_period = stats_period
        assert stats_period in (None, '24h', '14d')

    def get_attrs(self, item_list, user):
        attrs = super(StreamGroupSerializer, self).get_attrs(item_list, user)

        # we need to compute stats at 1d (1h resolution), and 14d
        group_ids = [g.id for g in item_list]
        if self.stats_period:
            days = 14 if self.stats_period == '14d' else 1
            now = timezone.now()
            stats = tsdb.rollup(tsdb.get_range(
                model=tsdb.models.group,
                keys=group_ids,
                end=now,
                start=now - timedelta(days=days),
            ), 3600 * days)

            for item in item_list:
                attrs[item].update({
                    'stats': stats[item.id],
                })
        return attrs

    def serialize(self, obj, attrs, user):
        result = super(StreamGroupSerializer, self).serialize(obj, attrs, user)

        if self.stats_period:
            result['stats'] = {
                self.stats_period: attrs['stats'],
            }

        return result


class SharedGroupSerializer(GroupSerializer):
    def serialize(self, obj, attrs, user):
        result = super(SharedGroupSerializer, self).serialize(obj, attrs, user)
        del result['annotations']
        return result
