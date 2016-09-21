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
from sentry.utils import warnings


class State(local):
    request = None
    data = {}

env = State()


def get_instance(attribute, options, dangerous=()):
    value = getattr(settings, attribute)

    cls = import_string(value)
    if cls in dangerous:
        warnings.warn(
            warnings.UnsupportedBackend(
                u'The {!r} backend for {} is not recommended '
                'for production use.'.format(value, attribute)
            )
        )

    return cls(**options)


# TODO(dcramer): this is getting heavy, we should find a better way to structure
# this
buffer = get_instance('SENTRY_BUFFER', settings.SENTRY_BUFFER_OPTIONS)

from sentry.digests.backends.dummy import DummyBackend
digests = get_instance('SENTRY_DIGESTS', settings.SENTRY_DIGESTS_OPTIONS, (DummyBackend,))
quotas = get_instance('SENTRY_QUOTAS', settings.SENTRY_QUOTA_OPTIONS)
nodestore = get_instance('SENTRY_NODESTORE', settings.SENTRY_NODESTORE_OPTIONS)
ratelimiter = get_instance('SENTRY_RATELIMITER', settings.SENTRY_RATELIMITER_OPTIONS)
search = get_instance('SENTRY_SEARCH', settings.SENTRY_SEARCH_OPTIONS)

from sentry.tsdb.dummy import DummyTSDB
tsdb = get_instance('SENTRY_TSDB', settings.SENTRY_TSDB_OPTIONS, (DummyTSDB,))

raven = client
locks = LockManager(RedisLockBackend(redis.clusters.get('default')))
