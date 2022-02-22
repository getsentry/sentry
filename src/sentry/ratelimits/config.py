import logging
from dataclasses import dataclass, field
from typing import Mapping, Union

from sentry.types.ratelimit import RateLimit, RateLimitCategory

_LOGGER = logging.getLogger("sentry.ratelimits.config")


class _sentinel:
    pass


class InvalidRateLimitConfig(Exception):
    pass


RateLimitOverrideDict = Mapping[str, Mapping[RateLimitCategory, RateLimit]]
GroupName = str

# This default value is going to shrink over time
_SENTRY_RATELIMITER_DEFAULT = 620


_SENTRY_RATELIMITER_GROUP_DEFAULTS: Mapping[GroupName, Mapping[RateLimitCategory, RateLimit]] = {
    "default": {
        category: RateLimit(_SENTRY_RATELIMITER_DEFAULT, 1) for category in RateLimitCategory
    }
}


def _get_group_defaults() -> Mapping[GroupName, Mapping[RateLimitCategory, RateLimit]]:
    return _SENTRY_RATELIMITER_GROUP_DEFAULTS


def get_default_rate_limits_for_group(group_name: str, category: RateLimitCategory) -> RateLimit:
    # group rate limits are calculated as follows:

    # If the group is not configured in _SENTRY_RATELIMITER_GROUP_DEFAULTS, use the "default" group
    # config
    group_defaults = _get_group_defaults()
    group_config = group_defaults.get(group_name, None)
    if group_config and category in group_config:
        return group_config[category]
    else:
        _LOGGER.warning("Invalid group config for %s, %s", group_name, category)
    # if the config doesn't have the rate limit category always fall back to default
    # if the category is undefined, fall back to the default rate limit per organization

    # this level of checking is done to make sure the rate limit configuration being bad
    # doesn't mean the API endpoint crashes
    return group_defaults["default"].get(
        category, group_defaults["default"][RateLimitCategory.ORGANIZATION]
    )


@dataclass(frozen=True)
class RateLimitConfig:
    group: str = field(default="default")
    limit_overrides: Union[RateLimitOverrideDict, _sentinel] = field(default=_sentinel())

    def get_rate_limit(self, http_method: str, category: RateLimitCategory) -> RateLimit:
        if isinstance(self.limit_overrides, _sentinel):
            return get_default_rate_limits_for_group(self.group, category)
        override_rate_limit = self.limit_overrides.get(http_method, {}).get(category, None)
        if isinstance(override_rate_limit, RateLimit):
            return override_rate_limit
        return get_default_rate_limits_for_group(self.group, category)

    @classmethod
    def from_rate_limit_override_dict(
        cls, rate_limit_override_dict: Union["RateLimitConfig", RateLimitOverrideDict]
    ) -> "RateLimitConfig":
        if isinstance(rate_limit_override_dict, cls):
            return rate_limit_override_dict
        elif isinstance(rate_limit_override_dict, dict):
            _LOGGER.warning("deprecated rate limit specification %s", rate_limit_override_dict)
            return cls(limit_overrides=rate_limit_override_dict)
        raise InvalidRateLimitConfig


DEFAULT_RATE_LIMIT_CONFIG = RateLimitConfig()
