from dataclasses import dataclass
from typing import Literal

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    HistogramMode,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.search.eap.types import SearchResolverConfig

TraceMetricType = Literal["counter", "gauge", "distribution", "histogram"]

# Represents "any unit" — no unit filter is applied
ANY_UNIT = "-"

# Represents "no unit" — only items with no unit are selected
NONE_UNIT = "none"


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

        if self.metric_unit == NONE_UNIT:
            unit_key = AttributeKey(name="sentry.metric_unit", type=AttributeKey.Type.TYPE_STRING)

            # In the case of NONE_UNIT, we want to select all items that do not have a unit, or
            # have a unit explicitly set to "none"
            filters.extend(
                [
                    TraceItemFilter(
                        or_filter=OrFilter(
                            filters=[
                                TraceItemFilter(
                                    not_filter=NotFilter(
                                        filters=[
                                            TraceItemFilter(
                                                exists_filter=ExistsFilter(key=unit_key)
                                            )
                                        ]
                                    )
                                ),
                                TraceItemFilter(
                                    comparison_filter=ComparisonFilter(
                                        key=unit_key,
                                        op=ComparisonFilter.OP_EQUALS,
                                        value=AttributeValue(val_str=self.metric_unit),
                                    )
                                ),
                            ]
                        )
                    )
                ]
            )
        elif self.metric_unit is not None and self.metric_unit != ANY_UNIT:
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


def get_histogram_mode(
    search_config: SearchResolverConfig, trace_metric: TraceMetric | None
) -> HistogramMode.ValueType:
    # Only OTLP histograms are stored as bucket rows, every other metric is aggregated as is
    if (
        search_config.otlp_histograms
        and trace_metric is not None
        and trace_metric.metric_type == "histogram"
    ):
        return HistogramMode.HISTOGRAM_MODE_BUCKETS
    return HistogramMode.HISTOGRAM_MODE_UNSPECIFIED
