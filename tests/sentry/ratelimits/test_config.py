from typing import Any
from unittest import TestCase, mock

from sentry.ratelimits.config import (
    SENTRY_RATELIMITER_GROUP_DEFAULTS,
    RateLimitConfig,
    get_default_rate_limits_for_group,
)
from sentry.types.ratelimit import RateLimit, RateLimitCategory


class TestRateLimitConfig(TestCase):
    @mock.patch(
        "sentry.ratelimits.config._get_group_defaults",
        return_value={"blz": {RateLimitCategory.ORGANIZATION: RateLimit(limit=420, window=69)}},
    )
    def test_grouping(self, *m: Any) -> None:
        config = RateLimitConfig(group="blz")
        assert config.get_rate_limit("GET", RateLimitCategory.ORGANIZATION) == RateLimit(
            limit=420, window=69
        )

    def test_defaults(self) -> None:
        config = RateLimitConfig()
        for c in RateLimitCategory:
            for method in ("POST", "GET", "PUT", "DELETE"):
                assert isinstance(config.get_rate_limit(method, c), RateLimit)

    def test_override(self) -> None:
        config = RateLimitConfig(
            group="default",
            limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=1, window=1)}},
        )
        assert config.get_rate_limit("GET", RateLimitCategory.IP) == RateLimit(limit=1, window=1)
        assert config.get_rate_limit(
            "POST", RateLimitCategory.IP
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.IP)
        assert config.get_rate_limit(
            "GET", RateLimitCategory.ORGANIZATION
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.ORGANIZATION)

    def test_backwards_compatibility(self) -> None:
        override_dict = {"GET": {RateLimitCategory.IP: RateLimit(limit=1, window=1)}}
        assert RateLimitConfig.from_rate_limit_override_dict(override_dict) == RateLimitConfig(
            group="default", limit_overrides=override_dict
        )

    def test_invalid_config(self) -> None:
        config = RateLimitConfig(group="default", limit_overrides={"GET": {"invalid": "invalid"}})  # type: ignore[dict-item]
        ret = config.get_rate_limit("bloop", "badcategory")  # type: ignore[arg-type]
        assert ret == get_default_rate_limits_for_group("default", RateLimitCategory.ORGANIZATION)

    def test_group_defaults_cover_every_category(self) -> None:
        for group, limits in SENTRY_RATELIMITER_GROUP_DEFAULTS.items():
            for category in RateLimitCategory:
                assert category in limits, f"group {group!r} is missing {category}"

    def test_user_api_falls_back_to_group_default(self) -> None:
        config = RateLimitConfig(
            limit_overrides={"GET": {RateLimitCategory.USER: RateLimit(limit=1, window=1)}}
        )
        assert config.get_rate_limit(
            "GET", RateLimitCategory.USER_API
        ) == get_default_rate_limits_for_group("default", RateLimitCategory.USER_API)


class TestHasUserAPIOverride(TestCase):
    def test_no_overrides(self) -> None:
        assert not RateLimitConfig().has_user_api_override("GET")

    def test_declared(self) -> None:
        config = RateLimitConfig(
            limit_overrides={
                "GET": {RateLimitCategory.USER_API: RateLimit(limit=1, window=1)},
                "POST": {RateLimitCategory.USER: RateLimit(limit=1, window=1)},
            }
        )
        assert config.has_user_api_override("GET")
        assert not config.has_user_api_override("POST")
        assert not config.has_user_api_override("DELETE")

    def test_invalid_config(self) -> None:
        config = RateLimitConfig(limit_overrides={"GET": {"invalid": "invalid"}})  # type: ignore[dict-item]
        assert not config.has_user_api_override("GET")
