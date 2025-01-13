import time
from unittest import mock

from sentry.integrations.slack.rate_limiter import RateLimitState, SlackRateLimiter
from sentry.testutils.cases import TestCase
from sentry.cache import default_cache


class SlackRateLimiterTest(TestCase):
    def setUp(self):
        self.integration_id = 123
        self.rate_limiter = SlackRateLimiter(self.integration_id)
        self.channel = "#test-channel"
        # Clear any existing rate limit state
        default_cache.delete(self.rate_limiter._get_cache_key(self.channel))

    def test_no_rate_limit_when_no_state(self):
        """Test that requests are allowed when no rate limit state exists"""
        assert self.rate_limiter.check_rate_limit(self.channel) is None

    def test_rate_limit_active(self):
        """Test that requests are rate limited when a rate limit is active"""
        # Set up a rate limit
        now = time.time()
        wait_time = 30
        state = RateLimitState(
            next_allowed_time=now + wait_time,
            retry_after=wait_time
        )
        
        default_cache.set(
            self.rate_limiter._get_cache_key(self.channel),
            {"next_allowed_time": state.next_allowed_time, "retry_after": state.retry_after},
            self.rate_limiter.CACHE_TTL
        )

        # Check rate limit
        result = self.rate_limiter.check_rate_limit(self.channel)
        assert result is not None
        assert result > 0
        assert result <= wait_time

    def test_rate_limit_expired(self):
        """Test that expired rate limits are ignored"""
        # Set up an expired rate limit
        now = time.time()
        state = RateLimitState(
            next_allowed_time=now - 10,  # In the past
            retry_after=30
        )
        
        default_cache.set(
            self.rate_limiter._get_cache_key(self.channel),
            {"next_allowed_time": state.next_allowed_time, "retry_after": state.retry_after},
            self.rate_limiter.CACHE_TTL
        )

        # Check rate limit
        assert self.rate_limiter.check_rate_limit(self.channel) is None

    def test_update_rate_limit(self):
        """Test updating rate limit state"""
        retry_after = 30
        self.rate_limiter.update_rate_limit(self.channel, retry_after)

        # Verify state was stored
        state = default_cache.get(self.rate_limiter._get_cache_key(self.channel))
        assert state is not None
        assert state["retry_after"] == retry_after
        assert state["next_allowed_time"] > time.time()

    def test_update_rate_limit_default(self):
        """Test updating rate limit state with default retry time"""
        self.rate_limiter.update_rate_limit(self.channel)

        # Verify state was stored with default retry time
        state = default_cache.get(self.rate_limiter._get_cache_key(self.channel))
        assert state is not None
        assert state["retry_after"] == self.rate_limiter.DEFAULT_RETRY_AFTER
        assert state["next_allowed_time"] > time.time()