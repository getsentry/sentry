from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from parsimonious.exceptions import ParseError
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    TraceItemFilter,
)

from sentry.api import event_search
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events import filter as event_filter
from sentry.search.events.types import SnubaParams

OPERATOR_MAP = {"=": ComparisonFilter.OP_EQUALS}


@dataclass(frozen=True)
class ResolvedColumn:
    # The alias for this column
    snuba_alias: str  # `p95() as foo` -> `foo` or `p95()` -> `p95()`
    # The definition of this function as needed by the RPC
    proto_definition: AttributeAggregation | AttributeKey
    # Processor is the function run in the post process step to transform data into the final result
    processor: Callable[[Any], Any] | None

    def process_column(row: Any) -> None:
        """Pull the column from row, then process it and mutate it"""
        pass


@dataclass(frozen=True)
class SearchResolver:
    """The only attributes are things we want to cache and params

    Please do not store any state on the SearchResolver
    """

    params: SnubaParams
    query_config: SearchResolverConfig
    resolved_columns: dict[str, ResolvedColumn] = field(default_factory=dict())

    def _parse_query(self, querystring: str) -> event_filter.ParsedTerms:
        try:
            parsed_terms = event_search.parse_search_query(
                querystring,
                params=None,  # TODO
                # config_overrides
            )
        except ParseError as e:
            if e.expr is not None:
                raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")
            else:
                raise InvalidSearchQuery(f"Parse error for: {querystring}")

        return parsed_terms

    def resolve_query(self, querystring: str, params: SnubaParams) -> TraceItemFilter:
        """Given a query string in the public search syntax eg. `span.description:foo` construct the TraceItemFilter"""
        pass
        # parsed_query = self._parse_query(querystring)
        # parsed_terms = []
        # for item in parsed_query:
        #     if isinstance(item, event_filter.SearchFilter):
        #         parsed_terms.append(
        #             TraceItemFilter(
        #                 comparison_filter=ComparisonFilter(
        #                     key=AttributeKey(
        #                         name=item.key.name, type=AttributeKey.Type.TYPE_STRING
        #                     ),
        #                     op=OPERATOR_MAP[item.operator],
        #                     value=AttributeValue(val_str=item.value.raw_value),
        #                 )
        #             )
        #         )
        # if len(parsed_terms) > 1:
        #     return AndFilter(filters=parsed_terms)
        # else:
        #     return parsed_terms[0]

    def resolve_columns(
        self, selected_columns: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Given a list of columns resolve them and get their context if applicable

        This function will also dedupe the virtual column contexts if necessary
        """
        # go from public alias -> rpc
        # p = Procssors(parsed_column_name)
        # return [ResolvedColumn()]
        pass

    def resolve_column(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        # Check if column is an aggregate if so
        # self.resolve_aggregate(column)
        # else
        # self.resolve_attribute(column)

        # Cache the column
        # self.resolved_coluumn[alias] = ResolvedColumn()
        # return ResolvedColumn()
        pass

    def resolve_attributes(
        self, column: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Helper function to resolve a list of attributes instead of 1 attribute at a time"""
        pass

    def resolve_attribute(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext]:
        """Attributes are columns that aren't 'functions' or 'aggregates', usually this means string or numeric
        attributes (aka. tags), but can also refer to fields like span.description"""
        pass

    def resolve_aggregates(
        self, column: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Helper function to resolve a list of aggregates instead of 1 attribute at a time"""
        pass

    def resolve_aggregate(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext]:
        # Throw error if column is not an aggregate
        pass


def process_project(row):
    """Given a row of data"""
    pass


Processors: dict[str, Callable[[Any], Any]] = {"project": process_project}
