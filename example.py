#!/usr/bin/env python

from sentry.utils.runner import configure

configure()

from datetime import timedelta

from django.utils import timezone

from sentry.app import tsdb


items = (1, 2, 3)
tsdb.record_multi((
    (tsdb.models.users_affected_by_event, 1, items),
))

end = timezone.now()
start = end - timedelta(minutes=5)

interval, results = tsdb.get_distinct_counts(
    tsdb.models.users_affected_by_event,
    (0, 1,),
    start,
    end,
)

print interval, results
print 'Extra time included prior to start position:', timedelta(seconds=int(start.strftime('%s')) - interval[0])
print 'Extra time included after end position:', timedelta(seconds=interval[1] - int(end.strftime('%s')))
