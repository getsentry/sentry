from dataclasses import dataclass
from typing import Literal, cast

from rest_framework.exceptions import ErrorDetail, ValidationError
from rest_framework.request import Request
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry import features
from sentry.models.organization import Organization
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig

MetricType = Literal["counter", "gauge", "distribution"]


@dataclass(frozen=True, kw_only=True)
class TraceMetricsSearchResolverConfig(SearchResolverConfig):
    metric_name: str
    metric_type: MetricType

    def extra_conditions(self, search_resolver: SearchResolver) -> TraceItemFilter | None:
        if not self.metric_name or not self.metric_type:
            return None

        metric_name, _ = search_resolver.resolve_column("metric.name")
        if not isinstance(metric_name.proto_definition, AttributeKey):
            raise ValueError("Unable to resolve metric.name")

        metric_type, _ = search_resolver.resolve_column("metric.type")
        if not isinstance(metric_type.proto_definition, AttributeKey):
            raise ValueError("Unable to resolve metric.type")

        metric_name_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=metric_name.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=self.metric_name),
            )
        )
        metric_type_filter = TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=metric_type.proto_definition,
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str=self.metric_type),
            )
        )

        return TraceItemFilter(
            and_filter=AndFilter(filters=[metric_name_filter, metric_type_filter])
        )


ALLOWED_METRIC_TYPES: list[MetricType] = ["counter", "gauge", "distribution"]


def get_trace_metric_from_request(
    request: Request,
    organization: Organization,
) -> tuple[str, MetricType]:
    metric_name = request.GET.get("metricName")
    metric_type = request.GET.get("metricType")

    if not features.has(
        "organizations:tracemetrics-top-level-params", organization=organization, actor=request.user
    ):
        if not metric_name:
            metric_name = ""
        if not metric_type:
            metric_type = ""
    else:
        errors = {}

        if not metric_name:
            errors["metricName"] = ErrorDetail("This field is required.", code="required")

        if not metric_type:
            errors["metricType"] = ErrorDetail("This field is required.", code="required")
        elif metric_type not in ALLOWED_METRIC_TYPES:
            errors["metricType"] = ErrorDetail(
                string=f'"{metric_type}" is not a valid choice.', code="invalid_choice"
            )

        if errors:
            raise ValidationError(errors)

        assert metric_name

    return metric_name, cast(MetricType, metric_type)
