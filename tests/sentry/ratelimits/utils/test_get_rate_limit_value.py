from unittest import TestCase

from django.conf import settings

from sentry.api.base import Endpoint
from sentry.ratelimits import get_rate_limit_value
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class TestGetRateLimitValue(TestCase):
    def test_default_rate_limit_values(self):
        """Ensure that the default rate limits are called for endpoints without overrides."""

        class TestEndpoint(Endpoint):
            pass

        assert (
            get_rate_limit_value("GET", TestEndpoint, RateLimitCategory.IP)
            == settings.SENTRY_RATELIMITER_DEFAULTS[RateLimitCategory.IP]
        )
        assert (
            get_rate_limit_value("POST", TestEndpoint, RateLimitCategory.ORGANIZATION)
            == settings.SENTRY_RATELIMITER_DEFAULTS[RateLimitCategory.ORGANIZATION]
        )
        assert (
            get_rate_limit_value("DELETE", TestEndpoint, RateLimitCategory.USER)
            == settings.SENTRY_RATELIMITER_DEFAULTS[RateLimitCategory.USER]
        )

    def test_override_rate_limit(self):
        """Override one or more of the default rate limits."""

        class TestEndpoint(Endpoint):
            rate_limits = {
                "GET": {RateLimitCategory.IP: RateLimit(100, 5)},
                "POST": {RateLimitCategory.USER: RateLimit(20, 4)},
            }

        assert get_rate_limit_value("GET", TestEndpoint, RateLimitCategory.IP) == RateLimit(100, 5)
        assert (
            get_rate_limit_value("GET", TestEndpoint, RateLimitCategory.USER)
            == settings.SENTRY_RATELIMITER_DEFAULTS[RateLimitCategory.USER]
        )
        assert (
            get_rate_limit_value("POST", TestEndpoint, RateLimitCategory.IP)
            == settings.SENTRY_RATELIMITER_DEFAULTS[RateLimitCategory.IP]
        )
        assert get_rate_limit_value("POST", TestEndpoint, RateLimitCategory.USER) == RateLimit(
            20, 4
        )

    def test_inherit(self):
        class ParentEndpoint(Endpoint):
            rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(100, 5)}}

        class ChildEndpoint(ParentEndpoint):
            rate_limits = {"GET": {}}

        assert get_rate_limit_value("GET", ChildEndpoint, RateLimitCategory.IP) == RateLimit(100, 5)

    def test_multiple_inheritance(self):
        class ParentEndpoint(Endpoint):
            rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(100, 5)}}

        class Mixin:
            rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(2, 4)}}

        class ChildEndpoint(ParentEndpoint, Mixin):
            rate_limits = {"GET": {}}

        class ChildEndpointReverse(Mixin, ParentEndpoint):
            rate_limits = {"GET": {}}

        assert get_rate_limit_value("GET", ChildEndpoint, RateLimitCategory.IP) == RateLimit(100, 5)
        assert get_rate_limit_value("GET", ChildEndpointReverse, RateLimitCategory.IP) == RateLimit(
            2, 4
        )

    def test_non_endpoint(self):
        """Views that don't inherit Endpoint should not return a value."""

        class TestEndpoint:
            pass

        assert get_rate_limit_value("GET", TestEndpoint, RateLimitCategory.IP) is None
        assert get_rate_limit_value("POST", TestEndpoint, RateLimitCategory.ORGANIZATION) is None
        assert get_rate_limit_value("DELETE", TestEndpoint, RateLimitCategory.USER) is None
