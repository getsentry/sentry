#!/usr/bin/env python

from sentry.utils.runner import configure

configure()

import itertools
import sys

from sentry.digests.notifications import (
    build_digest,
    event_to_record,
)
from sentry.models import (
    Event,
    Project,
)

project = Project.objects.get(id=int(sys.argv[1]))
events = project.event_set.all()[:int(sys.argv[2])]
Event.objects.bind_nodes(events, 'data')
records = itertools.imap(event_to_record, events)

print '{project.organization} / {project}'.format(project=project)
print ''

for group, records in build_digest(project, records):
    print '*', group.message_short
    print ' ', len(records), 'events from', min(r.timestamp for r in records), 'to', max(r.timestamp for r in records)
    print ''
