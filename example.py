#!/usr/bin/env python

from sentry.utils.runner import configure

configure()

import random
import pprint
from datetime import timedelta

from django.utils import timezone

from sentry.app import tsdb

keys = range(10)

tsdb.record_multi([
    (tsdb.models.users_affected_by_event, k, [random.randint(0, 1e6) for _ in xrange(random.randint(1, 50))]) for k in keys
])

end = timezone.now()
start = end - timedelta(seconds=60)

totals = tsdb.get_distinct_counts_totals(
    tsdb.models.users_affected_by_event,
    keys,
    start,
    end,
)

pprint.pprint(totals)

series = tsdb.get_distinct_counts_series(
    tsdb.models.users_affected_by_event,
    keys,
    start,
    end,
)

pprint.pprint(series)
