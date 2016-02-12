"""
sentry.tasks.options
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import logging
from datetime import timedelta
from django.utils import timezone

from sentry.models import Option
from sentry.options import default_manager
from sentry.options.manager import UnknownOption
from sentry.tasks.base import instrumented_task

ONE_HOUR = 60 * 60
logger = logging.getLogger('sentry')


@instrumented_task(name='sentry.tasks.options.sync_options', queue='options')
def sync_options(cutoff=ONE_HOUR):
    """
    Ensures all options that have been updated (within the database) since
    ``cutoff`` have their correct values stored in the cache.

    This **does not** guarantee that the correct value is written into the cache
    though it will correct itself in the next update window.
    """
    cutoff_dt = timezone.now() - timedelta(seconds=cutoff)
    # TODO(dcramer): this doesnt handle deleted options (which shouldn't be allowed)
    for option in Option.objects.filter(last_updated__gte=cutoff_dt).iterator():
        try:
            opt = default_manager.lookup_key(option.key)
            default_manager.store.set_cache(opt, option.value)
        except UnknownOption as e:
            logger.exception(unicode(e))
