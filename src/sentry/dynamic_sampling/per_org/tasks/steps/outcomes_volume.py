"""Step 1: fetch per-org volume from `outcomes_raw`.

A single `outcomes_raw` query returns both per-project volumes and the org
aggregate. The result doubles as the cycle's volume gate: if the org has no
outcomes in the window, the orchestrator skips the EAP batch and all
downstream steps.
"""

from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def fetch_outcomes_volume(org_id: int, organization: Organization) -> object | None:
    return None


def has_recent_volume(outcomes: object | None) -> bool:
    return outcomes is not None
