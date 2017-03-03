from __future__ import absolute_import, print_function

from sentry.tasks.base import instrumented_task
from sentry.lang.native.dsymcache import dsymcache


@instrumented_task(name='sentry.tasks.clear_old_cached_dsyms',
                   time_limit=15,
                   soft_time_limit=10)
def clear_old_cached_dsyms():
    dsymcache.clear_old_entries()
