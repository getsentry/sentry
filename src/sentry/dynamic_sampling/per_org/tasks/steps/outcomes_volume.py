from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def fetch_outcomes_volume(org_id: int, organization: Organization) -> object | None:
    return None


def has_recent_volume(outcomes: object | None) -> bool:
    return outcomes is not None
