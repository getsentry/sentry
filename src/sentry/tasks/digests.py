from __future__ import absolute_import

import time

from sentry.digests.notifications import (
    build_digest,
    split_key,
)
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics


@instrumented_task(
    name='sentry.tasks.digests.schedule_digests',
    queue='digests.scheduling')
def schedule_digests():
    from sentry.app import digests

    deadline = time.time()
    timeout = 30  # TODO: Make this a setting, it also should match task expiration.

    # TODO: This might make sense to make probabilistic instead?
    digests.maintenance(deadline - timeout)

    deadline = time.time()
    for entry in digests.schedule(deadline):
        deliver_digest.delay(entry.key, entry.timestamp)
        metrics.timing('digests.schedule_latency', time.time() - entry.timestamp)


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

    # TODO: This should probably report, no matter the outcome of the task?
    metrics.timing('digests.delivery_latency', time.time() - schedule_timestamp)
