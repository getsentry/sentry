from __future__ import absolute_import

import time

from sentry.digests.notifications import (
    build_digest,
    split_key,
)
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name='sentry.tasks.digests.schedule_digests',
    queue='digests.scheduling')
def schedule_digests():
    from sentry.app import digests

    deadline = time.time()

    # The maximum (but hopefully not typical) expected delay can be roughly
    # calculated by adding together the schedule interval, the # of shards *
    # schedule timeout (at least until these are able to be processed in
    # parallel), the expected duration of time an item spends waiting in the
    # queue to be processed for delivery and the expected duration of time an
    # item takes to be processed for delivery, so this timeout should be
    # relatively high to avoid requeueing items before they even had a chance
    # to be processed.
    timeout = 300
    digests.maintenance(deadline - timeout)

    for entry in digests.schedule(deadline):
        deliver_digest.delay(entry.key, entry.timestamp)


@instrumented_task(
    name='sentry.tasks.digests.deliver_digest',
    queue='digests.delivery')
def deliver_digest(key, schedule_timestamp):
    from sentry.app import digests

    plugin, project = split_key(key)
    with digests.digest(key) as records:
        digest = build_digest(project, records)

    if digest:
        plugin.notify_digest(project, digest)
