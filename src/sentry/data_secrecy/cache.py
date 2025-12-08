from datetime import datetime

from django.core.cache import cache

from sentry.data_secrecy.types import CACHE_KEY_PATTERN, EffectiveGrantStatus


class EffectiveGrantStatusCache:
    @staticmethod
    def get(organization_id: int) -> EffectiveGrantStatus:
        """
        Retrieve cached grant status for an organization.
        """
        cache_key = CACHE_KEY_PATTERN.format(organization_id=organization_id)
        cached_data = cache.get(cache_key)

        return EffectiveGrantStatus.from_cache(cached_data)

    @staticmethod
    def set(
        organization_id: int, grant_status: EffectiveGrantStatus, current_time: datetime
    ) -> None:
        """
        Set the cached grant status for an organization.
        """
        cache_key = CACHE_KEY_PATTERN.format(organization_id=organization_id)
        cache.set(
            cache_key,
            grant_status,
            timeout=grant_status.cache_ttl(current_time),
        )

    @staticmethod
    def delete(organization_id: int) -> None:
        """
        Delete the cached grant status for an organization.
        """
        cache_key = CACHE_KEY_PATTERN.format(organization_id=organization_id)
        cache.delete(cache_key)


effective_grant_status_cache = EffectiveGrantStatusCache()
