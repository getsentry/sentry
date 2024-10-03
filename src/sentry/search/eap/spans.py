from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from parsimonious.exceptions import ParseError
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.api import event_search
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap.span_columns import SPAN_COLUMN_DEFINITIONS
from sentry.search.eap.types import ResolvedColumn, SearchResolverConfig
from sentry.search.events import filter as event_filter
from sentry.search.events.types import SnubaParams

OPERATOR_MAP = {"=": ComparisonFilter.OP_EQUALS}
STRING = AttributeKey.TYPE_STRING
BOOLEAN = AttributeKey.TYPE_BOOLEAN
FLOAT = AttributeKey.TYPE_FLOAT
INT = AttributeKey.TYPE_INT


@dataclass(frozen=True)
class SearchResolver:
    """The only attributes are things we want to cache and params

    Please do not store any state on the SearchResolver
    """

    params: SnubaParams
    config: SearchResolverConfig
    resolved_columns: dict[str, ResolvedColumn] = field(default_factory=dict)

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

    def resolve_query(self, querystring: str) -> TraceItemFilter:
        """Given a query string in the public search syntax eg. `span.description:foo` construct the TraceItemFilter"""
        parsed_query = self._parse_query(querystring)
        if any(
            isinstance(term, event_search.ParenExpression)
            or event_search.SearchBoolean.is_operator(term)
            for term in parsed_query
        ):
            return self._resolve_boolean_conditions(parsed_query)
        else:
            return self._resolve_terms(parsed_query)

    def _resolve_boolean_conditions(self, terms: event_filter.ParsedTerms) -> TraceItemFilter:
        if len(terms) == 1:
            return self._resolve_boolean_condition(terms[0])

        # Filter out any ANDs since we can assume anything without an OR is an AND. Also do some
        # basic sanitization of the query: can't have two operators next to each other, and can't
        # start or end a query with an operator.
        previous_term: event_filter.ParsedTerm | None = None
        new_terms = []
        term: event_filter.ParsedTerm | None = None
        for term in terms:
            if previous_term:
                if event_search.SearchBoolean.is_operator(
                    previous_term
                ) and event_search.SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Missing condition in between two condition operators: '{previous_term} {term}'"
                    )
            else:
                if event_search.SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Condition is missing on the left side of '{term}' operator"
                    )

            if term != event_search.SearchBoolean.BOOLEAN_AND:
                new_terms.append(term)

            previous_term = term

        if term is not None and event_search.SearchBoolean.is_operator(term):
            raise InvalidSearchQuery(f"Condition is missing on the right side of '{term}' operator")
        terms = new_terms

        # We put precedence on AND, which sort of counter-intuitively means we have to split the query
        # on ORs first, so the ANDs are grouped together. Search through the query for ORs and split the
        # query on each OR.
        # We want to maintain a binary tree, so split the terms on the first OR we can find and recurse on
        # the two sides. If there is no OR, split the first element out to AND
        index = None
        lhs, rhs = None, None
        operator = None
        try:
            index = terms.index(event_search.SearchBoolean.BOOLEAN_OR)
            lhs, rhs = terms[:index], terms[index + 1 :]
            operator = OrFilter
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = AndFilter

        lhs = self._resolve_boolean_conditions(lhs)
        rhs = self._resolve_boolean_conditions(rhs)

        return self._combine_conditions(lhs, rhs, operator)

    def _combine_conditions(
        self, lhs: TraceItemFilter, rhs: TraceItemFilter, operator: AndFilter | OrFilter
    ) -> TraceItemFilter:
        if operator == AndFilter:
            return TraceItemFilter(and_filter=AndFilter(filters=[lhs, rhs]))
        elif operator == OrFilter:
            return TraceItemFilter(or_filter=OrFilter(filters=[lhs, rhs]))

    def _resolve_boolean_condition(self, term: event_filter.ParsedTerm) -> TraceItemFilter:
        if isinstance(term, event_search.ParenExpression):
            return self._resolve_boolean_conditions(term.children)

        if isinstance(term, event_search.SearchFilter):
            return self._resolve_term(term)

    def _resolve_terms(self, terms: event_filter.ParsedTerms) -> TraceItemFilter:
        parsed_terms = []
        for item in terms:
            parsed_terms.append(self._resolve_term(item))
        if len(parsed_terms) > 1:
            return TraceItemFilter(and_filter=AndFilter(filters=parsed_terms))
        else:
            return parsed_terms[0]

    def _resolve_term(self, term: event_filter.ParsedTerm) -> TraceItemFilter:
        if isinstance(term, event_filter.SearchFilter):
            resolved_column, context = self.resolve_column(term.key.name)
            return TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=resolved_column.proto_definition,
                    op=OPERATOR_MAP[term.operator],
                    value=self.resolve_value(resolved_column, term.operator, term.value.raw_value),
                )
            )

    def resolve_value(
        self,
        column: ResolvedColumn,
        operator: str,
        value: str | int | datetime | Sequence[int] | Sequence[str],
    ) -> AttributeValue:
        column.validate(value)
        column_type = column.proto_definition.type
        if column_type == STRING:
            if operator == "IN":
                if isinstance(value, Sequence[str]):
                    return AttributeValue(val_str_array=value)
                else:
                    raise InvalidSearchQuery()
            elif isinstance(value, str):
                return AttributeValue(val_str=value)

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

    def resolve_column(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext | None]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        return SPAN_COLUMN_DEFINITIONS[column], None
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
