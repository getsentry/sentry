from __future__ import absolute_import

from sentry.tasks.base import instrumented_task


@instrumented_task(
    name='sentry.tasks.symcache_update',
    time_limit=65,
    soft_time_limit=60,
)
def symcache_update(project_id, debug_ids, **kwargs):
    pass  # Noop. TODO(ja): Remove once unused.
