"""Step 5: distribute the org-level sample rate across projects.

Consumes the per-project volumes from the EAP batch in step 2.
"""

from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def boost_low_volume_projects(org_id: int, organization: Organization, eap: object) -> None:
    pass
