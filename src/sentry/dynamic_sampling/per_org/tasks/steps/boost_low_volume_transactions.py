from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def boost_low_volume_transactions(org_id: int, organization: Organization, eap: object) -> None:
    pass
