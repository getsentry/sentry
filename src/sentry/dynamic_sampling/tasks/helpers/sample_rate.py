# Import path kept for getsentry. Delete this module once getsentry imports from
# sentry.dynamic_sampling.per_org.serving.
from sentry.dynamic_sampling.per_org.serving import (
    get_organization_sample_rate as get_org_sample_rate,
)

__all__ = ["get_org_sample_rate"]
