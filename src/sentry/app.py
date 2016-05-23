"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from threading import local

from django.conf import settings
from raven.contrib.django.models import client

from sentry.utils import redis
from sentry.utils.imports import import_string
from sentry.utils.locking.backends.redis import RedisLockBackend
from sentry.utils.locking.manager import LockManager


class State(local):
    request = None
    data = {}

env = State()


def get_instance(path, options):
    cls = import_string(path)
    return cls(**options)


# TODO(dcramer): this is getting heavy, we should find a better way to structure
# this
buffer = get_instance(settings.SENTRY_BUFFER, settings.SENTRY_BUFFER_OPTIONS)
digests = get_instance(settings.SENTRY_DIGESTS, settings.SENTRY_DIGESTS_OPTIONS)
quotas = get_instance(settings.SENTRY_QUOTAS, settings.SENTRY_QUOTA_OPTIONS)
nodestore = get_instance(
    settings.SENTRY_NODESTORE, settings.SENTRY_NODESTORE_OPTIONS)
ratelimiter = get_instance(
    settings.SENTRY_RATELIMITER, settings.SENTRY_RATELIMITER_OPTIONS)
search = get_instance(settings.SENTRY_SEARCH, settings.SENTRY_SEARCH_OPTIONS)
tsdb = get_instance(settings.SENTRY_TSDB, settings.SENTRY_TSDB_OPTIONS)
raven = client
locks = LockManager(RedisLockBackend(redis.clusters.get('default')))
