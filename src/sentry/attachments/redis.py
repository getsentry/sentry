"""
sentry.attachments.redis
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.cache.redis import RedisCache

from .base import BaseAttachmentCache


class RedisAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options):
        super(RedisAttachmentCache, self).__init__(RedisCache(**options), **options)
