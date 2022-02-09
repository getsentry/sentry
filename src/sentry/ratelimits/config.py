from dataclasses import dataclass, field
from typing import Mapping, Union

from sentry.types.ratelimit import RateLimit, RateLimitCategory


class _sentinel:
    pass


RateLimitOverrideDict = Mapping[str, Mapping[RateLimitCategory, RateLimit]]


def get_default_rate_limits_for_group(group_name: str) -> RateLimit:
    # TODO: make group config
    return RateLimit(window=1, limit=40, concurrent_limit=15)


@dataclass
class RateLimitConfig:
    group: str = field(default="default")
    limit_overrides: Union[RateLimitOverrideDict, _sentinel] = field(default=_sentinel())

    def get_rate_limit(self, http_method: str, category: RateLimitCategory) -> RateLimit:
        if isinstance(self.limit_overrides, _sentinel):
            return get_default_rate_limits_for_group(self.group)
        override_rate_limit = self.limit_overrides.get(http_method, {}).get(category, None)
        if isinstance(override_rate_limit, RateLimit):
            return override_rate_limit
        return get_default_rate_limits_for_group(self.group)

    @classmethod
    def from_rate_limit_override_dict(
        cls, rate_limit_override_dict: RateLimitOverrideDict
    ) -> "RateLimitConfig":
        return cls(limit_overrides=rate_limit_override_dict)
