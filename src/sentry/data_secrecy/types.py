from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import StrEnum

from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus

CACHE_KEY_PATTERN = "data_access_grant:effective_grant_status:{organization_id}"
NEGATIVE_CACHE_TTL = 2 * 60  # 2 minutes
NEGATIVE_CACHE_VALUE = {"no_active_grants": True}


class GrantCacheStatus(StrEnum):
    CACHE_MISS = "cache_miss"
    NEGATIVE_CACHE = "negative_cache"
    VALID_WINDOW = "valid_window"
    EXPIRED_WINDOW = "expired_window"


@dataclass
class EffectiveGrantStatus:
    cache_status: GrantCacheStatus
    access_start: datetime | None = None
    access_end: datetime | None = None

    def __post_init__(self) -> None:
        # Holds the invariant that access_end and access_start are always set when cache_status is VALID_WINDOW
        if self.cache_status == GrantCacheStatus.VALID_WINDOW:
            if self.access_end is None or self.access_start is None:
                raise ValueError(
                    "access_end and access_start must be provided when cache_status is VALID_WINDOW"
                )

    @classmethod
    def from_cache(cls, cached_data: EffectiveGrantStatus | None) -> EffectiveGrantStatus:
        if cached_data is None:
            return cls(cache_status=GrantCacheStatus.CACHE_MISS)
        if cached_data.cache_status == GrantCacheStatus.NEGATIVE_CACHE:
            return cached_data

        if cached_data.access_end and cached_data.access_end <= datetime.now(timezone.utc):
            return cls(cache_status=GrantCacheStatus.EXPIRED_WINDOW)

        # Grant is still valid
        return cached_data

    @classmethod
    def from_rpc_grant_status(
        cls, rpc_grant_status: RpcEffectiveGrantStatus | None, current_time: datetime
    ) -> EffectiveGrantStatus:
        if rpc_grant_status:
            # Calculate TTL first to avoid race condition where grant expires between checks
            ttl_seconds = int((rpc_grant_status.access_end - current_time).total_seconds())

            # If the effective grant is expired or about to expire (TTL <= 0), we need to negative cache
            if ttl_seconds <= 0:
                return cls(cache_status=GrantCacheStatus.NEGATIVE_CACHE)

            return cls(
                cache_status=GrantCacheStatus.VALID_WINDOW,
                access_end=rpc_grant_status.access_end,
                access_start=rpc_grant_status.access_start,
            )

        return cls(cache_status=GrantCacheStatus.NEGATIVE_CACHE)

    def cache_ttl(self, current_time: datetime) -> int:
        if self.cache_status == GrantCacheStatus.VALID_WINDOW:
            assert self.access_end is not None
            return int((self.access_end - current_time).total_seconds())
        elif self.cache_status == GrantCacheStatus.NEGATIVE_CACHE:
            return NEGATIVE_CACHE_TTL
        else:
            raise ValueError("Invalid cache status")
