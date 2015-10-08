#!/usr/bin/env python

from sentry.utils.runner import configure

configure()

import random
import pprint
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from sentry.app import tsdb
from sentry.tsdb.redis import RedisTSDB
from sentry.tsdb.inmemory import InMemoryTSDB


backends = [
    InMemoryTSDB,
    RedisTSDB,
]


for backend in backends:
    print 'Testing %r...\n' % (backend,)

    database = backend(rollups=settings.SENTRY_TSDB_ROLLUPS)

    keys = range(10)

    database.record_multi([
        (tsdb.models.users_affected_by_event, k, [random.randint(0, 1e6) for _ in xrange(random.randint(1, 50))]) for k in keys
    ])

    start = timezone.now() - timedelta(seconds=60)

    totals = database.get_distinct_counts_totals(
        tsdb.models.users_affected_by_event,
        keys,
        start,
    )

    pprint.pprint(totals)

    series = database.get_distinct_counts_series(
        tsdb.models.users_affected_by_event,
        keys,
        start,
    )

    pprint.pprint(series)

    print '\n'
