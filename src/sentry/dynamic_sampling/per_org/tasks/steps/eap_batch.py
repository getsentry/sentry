"""Step 2: fan out every EAP query for this org in a single `table_rpc` batch.

Covers the sliding-window org volume, per-project volumes and transaction
totals, and the large/small transaction volumes. Grouping these into one
batch lets the snuba RPC layer execute them concurrently and keeps the
per-org round-trip count to exactly two (this batch plus the outcomes
query from step 1).
"""

from __future__ import annotations

from sentry.dynamic_sampling.per_org.tasks.telemetry import instrumented
from sentry.models.organization import Organization


@instrumented
def run_eap_batch(org_id: int, organization: Organization) -> object:
    return object()
