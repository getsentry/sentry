"""Step 4: compute the adjustment factor(s) from accepted vs. target indexed volume.

Uses the outcomes result from step 1 (no additional query needed).
"""

from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def apply_recalibration(org_id: int, organization: Organization, outcomes: object) -> None:
    pass
