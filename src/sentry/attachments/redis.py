"""
sentry.attachments.redis
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.conf import settings

from sentry.utils import redis
from .base import BaseAttachmentCache

logger = logging.getLogger(__name__)


class RedisAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        cluster_id = getattr(
            settings,
            'SENTRY_ATTACHMENTS_REDIS_CLUSTER',
            'rc-short'
        )
        cache = redis.redis_clusters.get(cluster_id)
        super(RedisAttachmentCache, self).__init__(cache, **options)
