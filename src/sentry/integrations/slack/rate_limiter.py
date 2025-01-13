import time
from dataclasses import dataclass
from typing import Dict, Optional

from django.conf import settings

from sentry.cache import default_cache


@dataclass
class RateLimitState:
    """Represents the current rate limit state for a channel"""
    next_allowed_time: float  # Unix timestamp when next request is allowed
    retry_after: int  # Seconds to wait before next attempt


class SlackRateLimiter:
    """Handles rate limiting for Slack API calls on a per-channel basis"""
    
    CACHE_TTL = 3600  # 1 hour cache TTL for rate limit state
    DEFAULT_RETRY_AFTER = getattr(settings, 'SLACK_MESSAGE_RATE_LIMIT_DEFAULT', 1)
    
    def __init__(self, integration_id: int):
        self.integration_id = integration_id
        self._cache_key_prefix = f"slack-rate-limit:{integration_id}"

    def _get_cache_key(self, channel: str) -> str:
        """Generate a cache key for a specific channel"""
        return f"{self._cache_key_prefix}:{channel}"

    def check_rate_limit(self, channel: str) -> Optional[float]:
        """
        Check if we should rate limit this request
        Returns: Seconds to wait if rate limited, None if allowed to proceed
        """
        cache_key = self._get_cache_key(channel)
        state = default_cache.get(cache_key)
        
        if not state:
            return None
            
        try:
            state = RateLimitState(**state)
            now = time.time()
            
            if now < state.next_allowed_time:
                return state.next_allowed_time - now
        except Exception:
            # If state is invalid, ignore it and proceed
            return None
            
        return None

    def update_rate_limit(self, channel: str, retry_after: Optional[int] = None) -> None:
        """
        Update rate limit state after an API call
        Args:
            channel: The Slack channel ID or name
            retry_after: Optional number of seconds to wait before next request
        """
        cache_key = self._get_cache_key(channel)
        retry_after = retry_after or self.DEFAULT_RETRY_AFTER
        
        state = RateLimitState(
            next_allowed_time=time.time() + retry_after,
            retry_after=retry_after
        )
        
        default_cache.set(
            cache_key,
            {"next_allowed_time": state.next_allowed_time, "retry_after": state.retry_after},
            self.CACHE_TTL
        )