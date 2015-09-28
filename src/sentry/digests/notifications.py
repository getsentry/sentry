from __future__ import absolute_import

import functools
import itertools
import logging
from collections import namedtuple

from sentry.models import (
    Group,
    Project,
)
from sentry.utils.dates import to_timestamp

from . import Record


logger = logging.getLogger('sentry.digests')


NotificationEvent = namedtuple('NotificationEvent', 'group_id event_id event_data rules')


def split_key(key):
    from sentry.plugins import plugins  # XXX
    plugin_slug, _, project_id = key.split(':', 2)
    return plugins.get(plugin_slug), Project.objects.get(pk=project_id)


def unsplit_key(plugin, project):
    return '{plugin.slug}:p:{project.id}'.format(plugin=plugin, project=project)


# XXX: Rules
def event_to_record(event, rules=[]):
    return Record(
        event.event_id,
        NotificationEvent(event.group_id, event.id, event.data.data, rules),
        to_timestamp(event.datetime),
    )


def group(records):
    key = lambda record: record.value.group_id
    raw = {}
    for group, records in itertools.groupby(sorted(records, key=key), key=key):
        yield group, list(records)


def associate_with_instance(project, groups):
    groups = dict(groups)

    instances = Group.objects.filter(project=project).in_bulk(groups.keys())
    for key, records in groups.iteritems():
        try:
            yield instances[key], records
        except KeyError:
            logger.warning('Skipping %s records for %s, no corresponding group instance exists.', len(records), id)
            continue


filter_muted_groups = functools.partial(
    itertools.ifilter,
    lambda (group, records): not group.is_muted(),
)


def build_digest(project, records):
    return filter_muted_groups(associate_with_instance(project, group(records)))
