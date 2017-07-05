"""
sentry.app
~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from threading import local

from raven.contrib.django.models import client

from sentry.utils import redis
from sentry.utils.locking.backends.redis import RedisLockBackend
from sentry.utils.locking.manager import LockManager


class State(local):
    request = None
    data = {}


env = State()

# COMPAT
from .buffer import backend as buffer  # NOQA
from .digests import backend as digests  # NOQA
from .newsletter import backend as newsletter  # NOQA
from .nodestore import backend as nodestore  # NOQA
from .quotas import backend as quotas  # NOQA
from .ratelimits import backend as ratelimiter  # NOQA
from .search import backend as search  # NOQA
from .tsdb import backend as tsdb  # NOQA

raven = client

locks = LockManager(RedisLockBackend(redis.clusters.get('default')))
