"""The pipeline-wide feature gate for PR Merge Live Metrics.

Its own module rather than part of ``utils``: ``attribution`` is imported by the pull
request API serializer, and reaching ``utils`` from there drags in the integration
services and Seer models early enough to be a circular import.
"""

from __future__ import annotations

from sentry import features
from sentry.models.organization import Organization


def is_pr_metrics_enabled(organization: Organization) -> bool:
    """Whether the pipeline runs for this organization at all.

    Checked at every entry point ahead of the per-stage ``pr-metrics-*`` flags. Those
    are finished rollouts on their way out; this one is permanent and carries the
    customer single-tenant exclusion — their analytics backend is a noop, so the
    emission this pipeline exists to produce has nowhere to land.
    """
    return features.has("organizations:pr-metrics", organization)
