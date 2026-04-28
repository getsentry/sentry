from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def run_eap_batch(org_id: int, organization: Organization) -> object:
    return object()
