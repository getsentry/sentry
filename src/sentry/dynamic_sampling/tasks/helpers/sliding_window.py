# Import path kept for getsentry. Delete this module once getsentry imports from
# sentry.dynamic_sampling.per_org.cache.
from sentry.dynamic_sampling.per_org.cache import (
    generate_organization_sample_rate_cache_key as generate_sliding_window_org_cache_key,
)

__all__ = ["generate_sliding_window_org_cache_key"]
