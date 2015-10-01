from __future__ import absolute_import

import functools
import itertools
import logging
from collections import namedtuple

from sentry.models import Project
from sentry.utils.dates import to_timestamp

from . import Record


logger = logging.getLogger('sentry.digests')


NotificationEvent = namedtuple('NotificationEvent', 'event rules')


def split_key(key):
    from sentry.plugins import plugins  # XXX
    plugin_slug, _, project_id = key.split(':', 2)
    return plugins.get(plugin_slug), Project.objects.get(pk=project_id)


def unsplit_key(plugin, project):
    return '{plugin.slug}:p:{project.id}'.format(plugin=plugin, project=project)


def strip_for_serialization(instance):
    cls = type(instance)
    return cls(**{field.attname: getattr(instance, field.attname) for field in cls._meta.fields})


# XXX: Rules
def event_to_record(event, rules=[], clean=strip_for_serialization):
    return Record(
        event.event_id,
        NotificationEvent(
            clean(event),
            map(clean, rules),
        ),
        to_timestamp(event.datetime),
    )


filter_muted_groups = functools.partial(
    itertools.ifilter,
    lambda (group, records): not group.is_muted(),
)


def build_digest(project, records):
    rules = {}
    for record in records:
        for rule in record.value.rules:
            rules.setdefault(rule, {}).setdefault(record.value.event.group, []).append(record)
    return rules
