from __future__ import annotations

import uuid

# This must never change otherwise it will break existing groupings
# You should also be careful mixing primary ids with other tables that
# can have overlapping id ranges.
PREPROD_NAMESPACE = uuid.UUID("31eca038-ed76-4e6d-b13b-ed30a6555213")
