from __future__ import absolute_import

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


def group_score((group, records)):
    return max(record.timestamp for record in records)


def record_score(record):
    return record.timestamp


def build_digest(project, records):
    """
    """
    key = lambda record: record.value.group_id

    raw = {}
    for group, records in itertools.groupby(sorted(records, key=key), key=key):
        raw[group] = list(records)

    groups = Group.objects.filter(project=project).in_bulk(raw.keys())

    results = []
    for id, records in raw.iteritems():
        try:
            group = groups[id]
        except IndexError:
            logger.warning('Skipping %s records for %s, no corresponding group instance exists.', len(records), id)
            continue

        if group.is_muted():
            logger.debug('Skipping %s records for %r, group is muted.', len(records), group)
            continue

        # TODO: Add other filter criteria.

        results.append((group, sorted(records, key=record_score)))

    return sorted(results, key=group_score)
