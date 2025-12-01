from dataclasses import dataclass
from typing import Literal

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

TraceMetricType = Literal["counter", "gauge", "distribution"]


@dataclass(frozen=True, kw_only=True)
class TraceMetric:
    metric_name: str
    metric_type: TraceMetricType
    metric_unit: str | None

    def get_filter(self) -> TraceItemFilter:
        filters = [
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="sentry.metric_name", type=AttributeKey.Type.TYPE_STRING),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=self.metric_name),
                )
            ),
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=AttributeKey(name="sentry.metric_type", type=AttributeKey.Type.TYPE_STRING),
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=self.metric_type),
                )
            ),
        ]

        if self.metric_unit:
            filters.append(
                TraceItemFilter(
                    comparison_filter=ComparisonFilter(
                        key=AttributeKey(
                            name="sentry.metric_unit", type=AttributeKey.Type.TYPE_STRING
                        ),
                        op=ComparisonFilter.OP_EQUALS,
                        value=AttributeValue(val_str=self.metric_unit),
                    )
                )
            )

        return TraceItemFilter(and_filter=AndFilter(filters=filters))
