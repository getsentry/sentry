"""
sentry.utils.javascript
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.urlresolvers import reverse
from django.utils.html import escape
from sentry.app import env
from sentry.constants import STATUS_RESOLVED
from sentry.models import Group, GroupBookmark
from sentry.templatetags.sentry_plugins import get_tags
from sentry.utils import json


transformers = {}


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

        if request and objects:
            handle_before_events(request, objects)

        if request and request.user.is_authenticated() and objects:
            bookmarks = set(GroupBookmark.objects.filter(
                user=request.user,
                group__in=objects,
            ).values_list('group_id', flat=True))
        else:
            bookmarks = set()

        if objects:
            historical_data = Group.objects.get_chart_data_for_group(
                instances=objects,
                max_days=1,
                key='group',
            )
        else:
            historical_data = {}

        for g in objects:
            g.is_bookmarked = g.pk in bookmarks
            g.historical_data = [x[1] for x in historical_data.get(g.id, [])]

    def transform(self, obj, request=None):
        d = {
            'id': str(obj.id),
            'count': str(obj.times_seen),
            'userCount': str(obj.users_seen),
            'title': escape(obj.message_top()),
            'message': escape(obj.error()),
            'level': obj.level,
            'levelName': escape(obj.get_level_display()),
            'logger': escape(obj.logger),
            'permalink': reverse('sentry-group', args=[obj.project.slug, obj.id]),
            'versions': list(obj.get_version() or []),
            'lastSeen': obj.last_seen.isoformat(),
            'timeSpent': obj.avg_time_spent,
            'canResolve': request and request.user.is_authenticated(),
            'isResolved': obj.status == STATUS_RESOLVED,
            'isPublic': obj.is_public,
            'score': getattr(obj, 'sort_value', 0),
            'project': {
                'name': obj.project.name,
                'slug': obj.project.slug,
            },
        }
        if hasattr(obj, 'is_bookmarked'):
            d['isBookmarked'] = obj.is_bookmarked
        if hasattr(obj, 'historical_data'):
            d['historicalData'] = obj.historical_data
        if request:
            d['tags'] = list(get_tags(obj, request))
        return d
