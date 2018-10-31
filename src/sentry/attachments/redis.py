"""
sentry.attachments.redis
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import logging

from django.conf import settings

from sentry.cache.redis import RedisClusterCache, RbCache
from .base import BaseAttachmentCache

logger = logging.getLogger(__name__)


class RedisClusterAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        appendix = options.pop('appendix', None)
        cluster_id = options.pop('cluster_id', None)
        if cluster_id is None:
            cluster_id = getattr(
                settings,
                'SENTRY_ATTACHMENTS_REDIS_CLUSTER',
                'rc-short'
            )
        BaseAttachmentCache.__init__(self,
                                     inner=RedisClusterCache(cluster_id, **options),
                                     appendix=appendix)


class RbAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        appendix = options.pop('appendix', None)
        BaseAttachmentCache.__init__(self,
                                     inner=RbCache(**options),
                                     appendix=appendix)


# Confusing legacy name for RediscClusterCache
RedisAttachmentCache = RedisClusterAttachmentCache
