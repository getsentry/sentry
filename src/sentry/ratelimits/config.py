import logging
from dataclasses import dataclass, field
from typing import Mapping, Union, cast

from sentry.types.ratelimit import RateLimit, RateLimitCategory

_LOGGER = logging.getLogger("sentry.ratelimits.config")


class _sentinel:
    pass


class InvalidRateLimitConfig(Exception):
    pass


class RateLimitGroup:
    """
    Groups are arbitrary clusters of endpoints that are useful to the business in the same dimension.
    Most endpoints belong to the default group. When endpoints belong to the same group,
    their rate limit uses the same key. Example:

    >>> EndpointA:
    >>>      rate_limits = RateLimitConfig(group="foo")

    >>> EndpointB:
    >>>      rate_limits = RateLimitConfig(group="foo")

    If a user is being rate limited on calls to EndpointA,
    they will also be rate limited on calls to EndpointB.

    However, endpoints with rate limit overrides disregard the group limit and have their own.

    >>> EndpointA:
    >>>      rate_limits = RateLimitConfig(
    >>>          group="foo", limit_overrides={"GET": {
    >>>             RateLimitCategory.IP: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
    >>>             RateLimitCategory.USER: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
    >>>             RateLimitCategory.ORGANIZATION: RateLimit(20, 1, CONCURRENT_RATE_LIMIT),
    >>>         }})

    >>> EndpointB:
    >>>      rate_limits = RateLimitConfig(group="foo")

    Endpoint A's endpoints will not influence Endpoint B's despite the fact that they are in
    the same group.

    We should work to remove these override limits and have endpoints which are closely
    tied by business usecase simply be in the same group.

    The custom overrides that exist today are holdovers from a time where
    we could only rate limit by endpoint. We don't have to do that anymore
    """

    default = "default"
    discover = "discover"
    orgstats = "orgstats"
    issues = "issues"
    auth = "auth"
    releases = "releases"


GroupName = str
HttpMethodName = str

RateLimitOverrideDict = Mapping[HttpMethodName, Mapping[RateLimitCategory, RateLimit]]

# This default value is going to shrink over time
_SENTRY_RATELIMITER_DEFAULT = 470

# The concurrent rate limiter stores a sorted set of requests, don't make this number
# too large (e.g > 100)
_SENTRY_CONCURRENT_RATE_LIMIT_DEFAULT = 100
ENFORCE_CONCURRENT_RATE_LIMITS = False


_SENTRY_RATELIMITER_GROUP_DEFAULTS: Mapping[GroupName, Mapping[RateLimitCategory, RateLimit]] = {
    RateLimitGroup.default: {
        category: RateLimit(_SENTRY_RATELIMITER_DEFAULT, 1, _SENTRY_CONCURRENT_RATE_LIMIT_DEFAULT)
        for category in RateLimitCategory
    }
    # TODO: define defaults for other groups
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

    def has_custom_limit(self) -> bool:
        return not isinstance(self.limit_overrides, _sentinel)

    def get_rate_limit(self, http_method: str, category: RateLimitCategory) -> RateLimit:
        if not self.has_custom_limit():
            return get_default_rate_limits_for_group(self.group, category)
        override_rate_limit = (
            cast(RateLimitOverrideDict, self.limit_overrides)
            .get(http_method, {})
            .get(category, None)
        )
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
