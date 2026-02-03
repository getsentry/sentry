from __future__ import annotations

import uuid

# This must never change otherwise it will break existing groupings
# You should also be careful mixing primary ids with other tables that
# can have overlapping id ranges.
PREPROD_NAMESPACE = uuid.UUID("31eca038-ed76-4e6d-b13b-ed30a6555213")


def get_preprod_trace_id(artifact_id: int) -> str:
    """Generate a deterministic trace_id for a preprod artifact.

    Uses UUID5 with PREPROD_NAMESPACE to ensure no collision with other trace types in EAP.
    This groups related components of the same build (e.g., main app + Watch extension)
    under one trace.
    """
    return uuid.uuid5(PREPROD_NAMESPACE, str(artifact_id)).hex
