"""Step 3: update the org's base sample rate from the sliding-window volume."""

from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def apply_sliding_window(org_id: int, organization: Organization, eap: object) -> None:
    pass
