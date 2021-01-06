from __future__ import absolute_import

import logging

from django.conf import settings

from sentry.cache.redis import RedisClusterCache
from .base import BaseAttachmentCache

logger = logging.getLogger(__name__)

# This constant modifies the cache version for `RedisClusterAttachmentCache`.
# The attachment cache is not actually a cache, but a short term data storage system.
# It inherits from cache backends, and so we're naming this setting to match this.
# Bumping this cache version will likely result in dropping events, so be very careful
# if you're doing so.
ATTACHMENT_CACHE_VERSION = 1


class RedisClusterAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        cluster_id = options.pop("cluster_id", None)
        if cluster_id is None:
            cluster_id = getattr(settings, "SENTRY_ATTACHMENTS_REDIS_CLUSTER", "rc-short")
        BaseAttachmentCache.__init__(
            self, inner=RedisClusterCache(cluster_id, version=ATTACHMENT_CACHE_VERSION, **options),
        )


# Confusing legacy name for RediscClusterCache
RedisAttachmentCache = RedisClusterAttachmentCache
