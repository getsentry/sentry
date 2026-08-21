"""The pipeline-wide feature gate for PR Merge Live Metrics.

Its own module rather than part of ``utils`` so the entry points can reach it
without paying for that module's import tree: ``attribution`` is imported by the
pull request API serializer, and pulling ``utils`` (and through it the
integration services and Seer models) in that early is a circular import.
"""

from __future__ import annotations

from sentry import features
from sentry.models.organization import Organization


def is_pr_metrics_enabled(organization: Organization) -> bool:
    """Whether the PR Merge Live Metrics pipeline runs for this organization at all.

    Checked first at every entry point — the GitHub webhook handlers, the Seer
    attribution and judge callbacks, the delegated-agent attribution, and the
    scheduled tasks — ahead of the per-stage ``pr-metrics-*`` checks that follow it.
    Those stage flags are finished rollouts on their way out; this one is permanent,
    and carries the customer single-tenant exclusion (their analytics backend is a
    noop, so the emission this pipeline exists to produce has nowhere to land). When
    the stage flags go, this is the gate that remains.
    """
    return features.has("organizations:pr-metrics", organization)
