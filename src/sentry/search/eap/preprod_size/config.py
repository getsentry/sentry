from dataclasses import dataclass

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import AttributeKey, AttributeValue
from sentry_protos.snuba.v1.trace_item_filter_pb2 import ComparisonFilter, TraceItemFilter

from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig


@dataclass(frozen=True, kw_only=True)
class PreprodSizeSearchResolverConfig(SearchResolverConfig):
    def extra_conditions(
        self,
        search_resolver: SearchResolver,
        selected_columns: list[str] | None,
        equations: list[str] | None,
    ) -> TraceItemFilter | None:
        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=AttributeKey(name="sub_item_type", type=AttributeKey.Type.TYPE_STRING),
                op=ComparisonFilter.OP_EQUALS,
                value=AttributeValue(val_str="size_metric"),
            )
        )
