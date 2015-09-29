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
    timeout = 30  # TODO: Make this a setting, it also should match task expiration.

    # TODO: This might make sense to make probabilistic instead?
    digests.maintenance(deadline - timeout)

    # TODO: Monitor schedule latency (deadline - schedule time).
    deadline = time.time()
    for entry in digests.schedule(deadline):
        # TODO: Pass through schedule time so we can monitor total lateny.
        deliver_digest.delay(entry.key)


@instrumented_task(
    name='sentry.tasks.digests.deliver_digest',
    queue='digests.delivery')
def deliver_digest(key):
    from sentry.app import digests

    plugin, project = split_key(key)
    with digests.digest(key) as records:
        digest = build_digest(project, records)

    plugin.notify_digest(digest)
