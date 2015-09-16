from sentry.utils.runner import configure

configure()

import contextlib
import logging
import random
import sys
import time
import uuid

from sentry.app import timelines
from sentry.timelines.redis import Record


logging.basicConfig(level=logging.DEBUG)


@contextlib.contextmanager
def timer(preamble):
    start = time.time()
    yield
    print '{0} in {1} ms.'.format(preamble, (time.time() - start) * 1000)


# Load a bunch of records.

n_timelines = int(sys.argv[1])
n_records = int(sys.argv[2])

with timer('Loaded {0} records to {1} timelines'.format(n_records, n_timelines)):
    for i in xrange(0, n_records):
        p = random.randint(1, n_timelines)
        record = Record(uuid.uuid1().hex, 'payload', time.time())
        timelines.add('projects/{0}'.format(p), record)


# Move them into the "ready" state.

ready = set()

with timer('Scheduled timelines for digestion'):
    for chunk in timelines.schedule(time.time()):
        for timeline, timestamp in chunk:
            ready.add(timeline)


# Run them through the digestion process.

with timer('Digested {0} timelines'.format(len(ready))):
    for timeline in ready:
        with timelines.digest(timeline) as records:
            i = 0
            for i, record in enumerate(records, 1):
                pass


# Run the scheduler again.

ready.clear()

with timer('Scheduled timelines for digestion'):
    for chunk in timelines.schedule(time.time() + timelines.interval):
        for timeline, timestamp in chunk:
            ready.add(timeline)


# Run them through the digestion process again (this should result in all of
# the items being taken out of the schedule.)

with timer('Digested {0} timelines'.format(len(ready))):
    for timeline in ready:
        with timelines.digest(timeline) as records:
            i = 0
            for i, record in enumerate(records, 1):
                pass


# Check to make sure we're not leaking any data.

with timelines.cluster.all() as client:
    result = client.keys('*')

for host, value in result.value.iteritems():
    assert not value
