"""
sentry.utils.javascript
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from collections import defaultdict
from datetime import timedelta
from django.core.urlresolvers import reverse
from django.utils import timezone
from django.utils.html import escape

from sentry.app import env, tsdb
from sentry.constants import TAG_LABELS
from sentry.models import (
    Group, GroupBookmark, GroupMeta, GroupTagKey, GroupSeen, GroupStatus,
    ProjectOption
)
from sentry.templatetags.sentry_plugins import get_legacy_annotations
from sentry.utils import json
from sentry.utils.db import attach_foreignkey
from sentry.utils.http import absolute_uri


transformers = {}


def has_sourcemap(event):
    if event.platform != 'javascript':
        return False
    data = event.data

    if 'sentry.interfaces.Exception' not in data:
        return False
    exception = data['sentry.interfaces.Exception']
    for value in exception['values']:
        stacktrace = value.get('stacktrace', {})
        for frame in stacktrace.get('frames', []):
            if 'sourcemap' in frame.get('data', {}):
                return True

    return False


def transform(objects, request=None):
    if request is None:
        request = getattr(env, 'request', None)
    if not objects:
        return objects
    elif not isinstance(objects, (list, tuple)):
        return transform([objects], request=request)[0]
    # elif isinstance(obj, dict):
    #     return dict((k, transform(v, request=request)) for k, v in obj.iteritems())
    t = transformers.get(type(objects[0]))

    if t:
        t.attach_metadata(objects, request=request)
        return [t(o, request=request) for o in objects]
    return objects


def to_json(obj, request=None):
    result = transform(obj, request=request)
    return json.dumps(result)


def register(type):
    def wrapped(cls):
        transformers[type] = cls()
        return cls
    return wrapped


class Transformer(object):
    def __call__(self, obj, request=None):
        return self.transform(obj, request)

    def attach_metadata(self, objects, request=None):
        pass

    def transform(self, obj, request=None):
        return {}


@register(Group)
class GroupTransformer(Transformer):
    def attach_metadata(self, objects, request=None):
        from sentry.templatetags.sentry_plugins import handle_before_events

        attach_foreignkey(objects, Group.project, ['team'])

        GroupMeta.objects.populate_cache(objects)

        if request and objects:
            handle_before_events(request, objects)

        if request and request.user.is_authenticated() and objects:
            bookmarks = set(GroupBookmark.objects.filter(
                user=request.user,
                group__in=objects,
            ).values_list('group_id', flat=True))
            seen_groups = dict(GroupSeen.objects.filter(
                user=request.user,
                group__in=objects,
            ).values_list('group_id', 'last_seen'))
        else:
            bookmarks = set()
            seen_groups = {}

        if objects:
            end = timezone.now()
            start = end - timedelta(days=1)

            historical_data = tsdb.get_range(
                model=tsdb.models.group,
                keys=[g.id for g in objects],
                start=start,
                end=end,
            )
        else:
            historical_data = {}

        project_list = set(o.project for o in objects)
        tag_keys = set(['sentry:user'])
        project_annotations = {}
        for project in project_list:
            enabled_annotations = ProjectOption.objects.get_value(
                project, 'annotations', ['sentry:user'])
            project_annotations[project] = enabled_annotations
            tag_keys.update(enabled_annotations)

        annotation_counts = defaultdict(dict)
        annotation_results = GroupTagKey.objects.filter(
            group__in=objects,
            key__in=tag_keys,
        ).values_list('key', 'group', 'values_seen')
        for key, group_id, values_seen in annotation_results:
            annotation_counts[key][group_id] = values_seen

        for g in objects:
            g.is_bookmarked = g.pk in bookmarks
            g.historical_data = [x[1] for x in historical_data.get(g.id, [])]
            active_date = g.active_at or g.last_seen
            g.has_seen = seen_groups.get(g.id, active_date) > active_date
            g.annotations = []
            for key in sorted(tag_keys):
                if key in project_annotations[project]:
                    label = TAG_LABELS.get(key, key.replace('_', ' ')).lower() + 's'
                    try:
                        value = annotation_counts[key].get(g.id, 0)
                    except KeyError:
                        value = 0
                    g.annotations.append({
                        'label': label,
                        'count': value,
                    })

    def localize_datetime(self, dt, request=None):
        if not request:
            return dt.isoformat()
        elif getattr(request, 'timezone', None):
            return dt.astimezone(request.timezone).isoformat()
        return dt.isoformat()

    def transform(self, obj, request=None):
        status = obj.get_status()
        if status == GroupStatus.RESOLVED:
            status_label = 'resolved'
        elif status == GroupStatus.MUTED:
            status_label = 'muted'
        else:
            status_label = 'unresolved'

        version = obj.last_seen
        if obj.resolved_at:
            version = max(obj.resolved_at, obj.last_seen)
        version = int(version.strftime('%s'))

        d = {
            'id': str(obj.id),
            'count': str(obj.times_seen),
            'title': escape(obj.title),
            'message': escape(obj.message_short),
            'level': obj.level,
            'levelName': escape(obj.get_level_display()),
            'logger': escape(obj.logger),
            'permalink': absolute_uri(reverse('sentry-group', args=[obj.organization.slug, obj.project.slug, obj.id])),
            'firstSeen': self.localize_datetime(obj.first_seen, request=request),
            'lastSeen': self.localize_datetime(obj.last_seen, request=request),
            'canResolve': request and request.user.is_authenticated(),
            'status': status_label,
            'isResolved': obj.get_status() == GroupStatus.RESOLVED,
            'isPublic': obj.is_public,
            'score': getattr(obj, 'sort_value', 0),
            'project': {
                'name': escape(obj.project.name),
                'slug': obj.project.slug,
            },
            'version': version,
        }
        if hasattr(obj, 'is_bookmarked'):
            d['isBookmarked'] = obj.is_bookmarked
        if hasattr(obj, 'has_seen'):
            d['hasSeen'] = obj.has_seen
        if hasattr(obj, 'historical_data'):
            d['historicalData'] = obj.historical_data
        if hasattr(obj, 'annotations'):
            d['annotations'] = obj.annotations

        # TODO(dcramer): these aren't tags, and annotations aren't annotations
        if request:
            d['tags'] = get_legacy_annotations(obj, request)
        return d
