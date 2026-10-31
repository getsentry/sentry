import logging
from typing import cast

from django.conf import settings

from sentry.cache.redis import RedisClusterCache

from .base import BaseAttachmentCache

logger = logging.getLogger(__name__)


class RedisClusterAttachmentCache(BaseAttachmentCache):
    def __init__(self, **options: object) -> None:
        cluster_id = cast("str | None", options.pop("cluster_id", None))
        if cluster_id is None:
            cluster_id = getattr(settings, "SENTRY_ATTACHMENTS_REDIS_CLUSTER", "rc-short")
        version = options.pop("version", None)
        if version is not None and not isinstance(version, int):
            version = int(cast(str, version))
        prefix = options.pop("prefix", None)
        assert prefix is None or isinstance(prefix, str)
        is_default_cache = options.pop("is_default_cache", False)
        assert isinstance(is_default_cache, bool)
        BaseAttachmentCache.__init__(
            self,
            inner=RedisClusterCache(
                cluster_id,
                version=version,
                prefix=prefix,
                is_default_cache=is_default_cache,
            ),
        )


# Confusing legacy name for RediscClusterCache
RedisAttachmentCache = RedisClusterAttachmentCache
