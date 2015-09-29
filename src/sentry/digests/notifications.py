from __future__ import absolute_import

import functools
import itertools
import logging
from collections import (
    OrderedDict,
    namedtuple,
)

from sentry.models import (
    Group,
    Project,
)
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
def event_to_record(event, rules=[]):
    return Record(
        event.event_id,
        NotificationEvent(
            strip_for_serialization(event),
            map(strip_for_serialization, rules),
        ),
        to_timestamp(event.datetime),
    )


def group(records):
    key = lambda record: record.value.event.group_id
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


class NotificationDigest(object):
    def __init__(self, groups):
        self.groups = groups

    @property
    def event(self):
        # TODO: Probably warn about this.
        return self.groups.values()[0][0].value.event

    @property
    def rule(self):
        # TODO: Probably warn about this.
        return self.groups.values()[0][0].value.rules[0]

    @property
    def rules(self):
        # TODO: Probably warn about this.
        return self.groups.values()[0][0].value.rules


def build_digest(project, records):
    return NotificationDigest(
        OrderedDict(
            sorted(
                filter_muted_groups(associate_with_instance(project, group(records))),
                key=lambda (group, records): (len(records), max(record.timestamp for record in records)),
                reverse=True,
            ),
        )
    )
