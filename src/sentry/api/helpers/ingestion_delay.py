from __future__ import annotations

import logging

import sentry_sdk

from sentry.ingestion_delay.activity import ITEM_TYPE_TO_CATEGORY
from sentry.ingestion_delay.meta import IngestionMeta
from sentry.ingestion_delay.status import (
    IngestionDelayStatus,
)
from sentry.ingestion_delay.status import (
    get_ingestion_delay_status as compute_ingestion_delay_status,
)
from sentry.search.events.types import SnubaParams
from sentry.snuba.rpc_dataset_common import RPCBase
from sentry.utils.tracing import set_span_data, start_span

logger = logging.getLogger(__name__)


def serialize_ingestion_status(status: IngestionDelayStatus) -> IngestionMeta:
    meta = IngestionMeta(status=status.status)
    if status.delay_seconds is not None:
        meta["delaySeconds"] = status.delay_seconds
    if status.complete_through is not None:
        meta["completeThrough"] = status.complete_through.timestamp() * 1000
    return meta


def get_ingestion_delay_status(
    dataset: type[RPCBase], snuba_params: SnubaParams
) -> IngestionDelayStatus | None:
    """Ingestion status only for EAP RPC datasets."""
    item_type = dataset.DEFINITIONS.trace_item_type

    if snuba_params.organization_id is None:
        return None

    if item_type not in ITEM_TYPE_TO_CATEGORY:
        logger.warning(
            "ingestion_delay.unsupported_item_type",
            extra={"organization_id": snuba_params.organization_id, "item_type": item_type},
        )
        return None

    with start_span(
        name="ingestion_delay.get_ingestion_delay_status",
        op="ingestion_delay.get_ingestion_delay_status",
    ) as span:
        set_span_data(span, "organization_id", snuba_params.organization_id)
        set_span_data(span, "item_type", item_type)
        try:
            return compute_ingestion_delay_status(
                organization_id=snuba_params.organization_id,
                project_ids=snuba_params.project_ids,
                item_type=item_type,
            )
        except Exception:
            sentry_sdk.capture_exception()
            return None
