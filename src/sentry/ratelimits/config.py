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
    "default": {RateLimitCategory.ORGANIZATION: RateLimit(_SENTRY_RATELIMITER_DEFAULT, 1)}
}


def get_default_rate_limits_for_group(group_name: str, category: RateLimitCategory) -> RateLimit:
    # group rate limits are calculated as follows:

    # If the group is not configured in _SENTRY_RATELIMITER_GROUP_DEFAULTS, use the "default" group
    # config
    group_config = _SENTRY_RATELIMITER_GROUP_DEFAULTS.get(
        group_name, _SENTRY_RATELIMITER_GROUP_DEFAULTS["default"]
    )
    if category in group_config:
        return group_config[category]
    else:
        # if the specific category is not configured, try and find one in order of the enum
        for category in iter(RateLimitCategory):
            limit = group_config.get(category, None)
            if isinstance(limit, RateLimit):
                return limit

    return _SENTRY_RATELIMITER_GROUP_DEFAULTS["default"][RateLimitCategory.ORGANIZATION]


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
