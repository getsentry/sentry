from __future__ import annotations

from datetime import UTC, datetime

from sentry.ingestion_delay.query import measure_delay_seconds
from sentry.search.events.types import SnubaParams
from sentry.snuba.rpc_dataset_common import RPCBase


def get_ingestion_delay_seconds(dataset: type[RPCBase], snuba_params: SnubaParams) -> float | None:
    """Measured ingestion delay only for EAP RPC datasets."""
    item_type = dataset.DEFINITIONS.trace_item_type

    if snuba_params.organization_id is None:
        return None

    return measure_delay_seconds(
        organization_id=snuba_params.organization_id,
        item_type=item_type,
        now=datetime.now(tz=UTC),
    )
