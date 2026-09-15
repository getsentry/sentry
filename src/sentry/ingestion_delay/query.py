from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from google.protobuf.timestamp_pb2 import Timestamp
from sentry_protos.snuba.v1.attribute_conditional_aggregation_pb2 import (
    AttributeConditionalAggregation,
)
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    Column,
    TraceItemTableRequest,
    TraceItemTableResponse,
)
from sentry_protos.snuba.v1.formula_pb2 import Literal
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta, TraceItemType
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeKeyExpression,
    ExtrapolationMode,
    Function,
)

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.snuba.referrer import Referrer
from sentry.utils import snuba_rpc

logger = logging.getLogger(__name__)

RECEIVED_AT_ATTRIBUTE = "sentry._internal.received_at"
INGESTED_AT_ATTRIBUTE = "sentry._internal.ingested_at"
MILLISECONDS_PER_SECOND = 1000.0

DELAY_LABEL = "ingestion_delay_seconds"
DELAY_AGGREGATE = Function.FUNCTION_P99

LAST_INGESTED_LABEL = "last_ingested_at"

# How far back the measurement window reaches.
MEASUREMENT_LOOKBACK = timedelta(minutes=60)


def build_delay_expression() -> AttributeKeyExpression:
    """(ingested_at / 1000) - received_at, evaluated per row."""
    return AttributeKeyExpression(
        formula=AttributeKeyExpression.Formula(
            op=AttributeKeyExpression.OP_SUB,
            left=AttributeKeyExpression(
                formula=AttributeKeyExpression.Formula(
                    op=AttributeKeyExpression.OP_DIV,
                    left=AttributeKeyExpression(
                        key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name=INGESTED_AT_ATTRIBUTE)
                    ),
                    right=AttributeKeyExpression(
                        literal=Literal(
                            val_double=MILLISECONDS_PER_SECOND
                        )  # ingested_at is in milliseconds while received_at is in seconds
                    ),
                )
            ),
            right=AttributeKeyExpression(
                key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name=RECEIVED_AT_ATTRIBUTE)
            ),
        )
    )


def build_delay_request(
    organization_id: int,
    project_ids: list[int],
    item_type: TraceItemType.ValueType,
    start: datetime,
    end: datetime,
) -> TraceItemTableRequest:
    return TraceItemTableRequest(
        meta=RequestMeta(
            organization_id=organization_id,
            project_ids=project_ids,
            referrer=Referrer.INGESTION_DELAY_MEASUREMENT.value,
            start_timestamp=Timestamp(seconds=int(start.timestamp())),
            end_timestamp=Timestamp(seconds=int(end.timestamp())),
            trace_item_type=item_type,
        ),
        columns=[
            Column(
                label=DELAY_LABEL,
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=DELAY_AGGREGATE,
                    expression=build_delay_expression(),
                    label=DELAY_LABEL,
                    extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
                ),
            ),
            Column(
                label=LAST_INGESTED_LABEL,
                conditional_aggregation=AttributeConditionalAggregation(
                    aggregate=Function.FUNCTION_MAX,
                    expression=AttributeKeyExpression(
                        key=AttributeKey(type=AttributeKey.TYPE_DOUBLE, name=INGESTED_AT_ATTRIBUTE)
                    ),
                    label=LAST_INGESTED_LABEL,
                    extrapolation_mode=ExtrapolationMode.EXTRAPOLATION_MODE_NONE,
                ),
            ),
        ],
    )


@dataclass(frozen=True)
class IngestionDelayMeasurement:
    delay_seconds: float | None = None
    last_ingested_at: datetime | None = None


NO_MEASUREMENT = IngestionDelayMeasurement()


def _column_value(response: TraceItemTableResponse, label: str) -> float | None:
    for column in response.column_values:
        if column.attribute_name == label and column.results:
            return column.results[0].val_double
    return None


def measure_ingestion_delay(
    organization_id: int,
    item_type: TraceItemType.ValueType,
    now: datetime,
) -> IngestionDelayMeasurement:
    """
    The p99 ingestion delay and the most recent write, in the last 60 minutes for the given organization and item type.
    """
    project_ids = list(
        Project.objects.filter(organization_id=organization_id, status=ObjectStatus.ACTIVE)
        .order_by("id")
        .values_list("id", flat=True)
    )
    if not project_ids:
        return NO_MEASUREMENT

    request = build_delay_request(
        organization_id=organization_id,
        project_ids=project_ids,
        item_type=item_type,
        start=now - MEASUREMENT_LOOKBACK,
        end=now,
    )

    try:
        responses = snuba_rpc.table_rpc([request])
    except Exception:
        logger.exception(
            "ingestion_delay.query_failed",
            extra={"organization_id": organization_id, "item_type": item_type},
        )
        return NO_MEASUREMENT

    if not responses or not responses[0].column_values:
        logger.warning(
            "ingestion_delay.no_responses",
            extra={"organization_id": organization_id, "item_type": item_type},
        )
        return NO_MEASUREMENT

    delay_seconds = _column_value(responses[0], DELAY_LABEL)
    last_ingested_ms = _column_value(responses[0], LAST_INGESTED_LABEL)

    # It's impossible for only one of these to be present, since they calculate from the same rows.
    if not delay_seconds or not last_ingested_ms:
        logger.warning(
            "ingestion_delay.no_results",
            extra={"organization_id": organization_id, "item_type": item_type},
        )
        return NO_MEASUREMENT

    last_ingested_at = datetime.fromtimestamp(last_ingested_ms / MILLISECONDS_PER_SECOND, tz=UTC)

    return IngestionDelayMeasurement(delay_seconds=delay_seconds, last_ingested_at=last_ingested_at)
