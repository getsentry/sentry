from unittest import TestCase

from sentry.api.base import Endpoint
from sentry.ratelimits import get_rate_limit_value
from sentry.ratelimits.config import RateLimitConfig, get_default_rate_limits_for_group
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class TestGetRateLimitValue(TestCase):
    def test_default_rate_limit_values(self):
        """Ensure that the default rate limits are called for endpoints without overrides."""

        class TestEndpoint(Endpoint):
            pass

        assert get_rate_limit_value(
            "GET", TestEndpoint, RateLimitCategory.IP
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert get_rate_limit_value(
            "POST", TestEndpoint, RateLimitCategory.ORGANIZATION
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.ORGANIZATION)
        assert get_rate_limit_value(
            "DELETE", TestEndpoint, RateLimitCategory.USER
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER)

    def test_override_rate_limit(self):
        """Override one or more of the default rate limits."""

        class TestEndpoint(Endpoint):
            rate_limits = {
                "GET": {RateLimitCategory.IP: RateLimit(100, 5)},
                "POST": {RateLimitCategory.USER: RateLimit(20, 4)},
            }

        assert get_rate_limit_value("GET", TestEndpoint, RateLimitCategory.IP) == RateLimit(100, 5)
        assert get_rate_limit_value(
            "GET", TestEndpoint, RateLimitCategory.USER
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER)
        assert get_rate_limit_value(
            "POST", TestEndpoint, RateLimitCategory.IP
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert get_rate_limit_value("POST", TestEndpoint, RateLimitCategory.USER) == RateLimit(
            20, 4
        )

    def test_inherit(self):
        class ParentEndpoint(Endpoint):
            rate_limits = RateLimitConfig(
                group="foo", limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(100, 5)}}
            )

        class ChildEndpoint(ParentEndpoint):
            rate_limits = RateLimitConfig(group="foo", limit_overrides={"GET": {}})

        assert get_rate_limit_value(
            "GET", ChildEndpoint, RateLimitCategory.IP
        ) == get_default_rate_limits_for_group("foo", RateLimitCategory.IP)

    def test_multiple_inheritance(self):
        class ParentEndpoint(Endpoint):
            rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(100, 5)}}

        class Mixin:
            rate_limits = {"GET": {RateLimitCategory.IP: RateLimit(2, 4)}}

        class ChildEndpoint(ParentEndpoint, Mixin):
            pass

        class ChildEndpointReverse(Mixin, ParentEndpoint):
            pass

        assert get_rate_limit_value("GET", ChildEndpoint, RateLimitCategory.IP) == RateLimit(100, 5)
        assert get_rate_limit_value("GET", ChildEndpointReverse, RateLimitCategory.IP) == RateLimit(
            2, 4
        )
