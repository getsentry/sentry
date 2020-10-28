from __future__ import absolute_import

import logging

from django.conf import settings

from sentry.cache.redis import RedisClusterCache, RbCache
from .base import BaseAttachmentCache

logger = logging.getLogger(__name__)


class RedisClusterAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        cluster_id = options.pop("cluster_id", None)
        if cluster_id is None:
            cluster_id = getattr(settings, "SENTRY_ATTACHMENTS_REDIS_CLUSTER", "rc-short")
        BaseAttachmentCache.__init__(self, inner=RedisClusterCache(cluster_id, **options))


class RbAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        BaseAttachmentCache.__init__(self, inner=RbCache(**options))


# Confusing legacy name for RediscClusterCache
RedisAttachmentCache = RedisClusterAttachmentCache
