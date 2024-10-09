from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from typing import cast

from parsimonious.exceptions import ParseError
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    IntArray,
    StrArray,
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
from sentry.search.eap import constants
from sentry.search.eap.columns import SPAN_COLUMN_DEFINITIONS, ResolvedColumn
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events import filter as event_filter
from sentry.search.events.types import SnubaParams


@dataclass(frozen=True)
class SearchResolver:
    """The only attributes are things we want to cache and params

    Please do not store any state on the SearchResolver
    """

    params: SnubaParams
    config: SearchResolverConfig
    resolved_columns: dict[str, ResolvedColumn] = field(default_factory=dict)

    def resolve_query(self, querystring: str) -> TraceItemFilter | None:
        """Given a query string in the public search syntax eg. `span.description:foo` construct the TraceItemFilter"""
        try:
            parsed_terms = event_search.parse_search_query(
                querystring,
                params=self.params.filter_params,
                get_field_type=self.get_field_type,
            )
        except ParseError as e:
            if e.expr is not None:
                raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")
            else:
                raise InvalidSearchQuery(f"Parse error for: {querystring}")

        if any(
            isinstance(term, event_search.ParenExpression)
            or event_search.SearchBoolean.is_operator(term)
            for term in parsed_terms
        ):
            return self._resolve_boolean_conditions(parsed_terms)
        else:
            return self._resolve_terms(parsed_terms)

    def _resolve_boolean_conditions(
        self, terms: event_filter.ParsedTerms
    ) -> TraceItemFilter | None:
        if len(terms) == 1:
            if isinstance(terms[0], event_search.ParenExpression):
                return self._resolve_boolean_conditions(terms[0].children)
            elif isinstance(terms[0], event_search.SearchFilter):
                return self._resolve_terms([cast(event_search.SearchFilter, terms[0])])
            else:
                raise NotImplementedError("Haven't handled all the search expressions yet")

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
        operator: type[OrFilter] | type[AndFilter] | None = None
        try:
            index = terms.index(event_search.SearchBoolean.BOOLEAN_OR)
            lhs, rhs = terms[:index], terms[index + 1 :]
            operator = OrFilter
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = AndFilter

        resolved_lhs = self._resolve_boolean_conditions(lhs) if lhs else None
        resolved_rhs = self._resolve_boolean_conditions(rhs) if rhs else None

        if resolved_lhs is not None and resolved_rhs is not None:
            if operator == AndFilter:
                return TraceItemFilter(and_filter=AndFilter(filters=[resolved_lhs, resolved_rhs]))
            else:
                return TraceItemFilter(or_filter=OrFilter(filters=[resolved_lhs, resolved_rhs]))
        elif resolved_lhs is None and resolved_rhs is not None:
            return resolved_rhs
        elif resolved_lhs is not None and resolved_rhs is None:
            return resolved_lhs
        else:
            return None

    def _resolve_terms(self, terms: event_filter.ParsedTerms) -> TraceItemFilter | None:
        parsed_terms = []
        for item in terms:
            if isinstance(item, event_search.SearchFilter):
                resolved_column, context = self.resolve_column(item.key.name)
                if item.operator in constants.OPERATOR_MAP:
                    operator = constants.OPERATOR_MAP[item.operator]
                else:
                    raise InvalidSearchQuery(f"Unknown operator: {item.operator}")
                if isinstance(resolved_column.proto_definition, AttributeKey):
                    parsed_terms.append(
                        TraceItemFilter(
                            comparison_filter=ComparisonFilter(
                                key=resolved_column.proto_definition,
                                op=operator,
                                value=self._resolve_search_value(
                                    resolved_column, item.operator, item.value.raw_value
                                ),
                            )
                        )
                    )
                else:
                    raise NotImplementedError("Can't filter on aggregates yet")
            else:
                raise NotImplementedError()

        if len(parsed_terms) > 1:
            return TraceItemFilter(and_filter=AndFilter(filters=parsed_terms))
        elif len(parsed_terms) == 1:
            return parsed_terms[0]
        else:
            return None

    def _resolve_search_value(
        self,
        column: ResolvedColumn,
        operator: str,
        value: str | int | datetime | Sequence[int] | Sequence[str],
    ) -> AttributeValue:
        column.validate(value)
        if isinstance(column.proto_definition, AttributeKey):
            column_type = column.proto_definition.type
            if column_type == constants.STRING:
                if operator in constants.IN_OPERATORS:
                    if isinstance(value, list) and all(isinstance(item, str) for item in value):
                        return AttributeValue(val_str_array=StrArray(values=value))
                    else:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid value for doing an IN filter"
                        )
                else:
                    return AttributeValue(val_str=str(value))
            elif column_type == constants.INT:
                # These int casts are only necessary because floats aren't supported in the proto yet
                if operator in constants.IN_OPERATORS:
                    if isinstance(value, list):
                        return AttributeValue(
                            val_int_array=IntArray(values=[int(val) for val in value])
                        )
                    else:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid value for doing an IN filter"
                        )
                elif isinstance(value, (int, float)):
                    return AttributeValue(val_int=int(value))
            raise InvalidSearchQuery(
                f"{value} is not a valid filter value for {column.public_alias}"
            )
        else:
            raise NotImplementedError("Aggregate Queries not implemented yet")

    def resolve_columns(
        self, selected_columns: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Given a list of columns resolve them and get their context if applicable

        This function will also dedupe the virtual column contexts if necessary
        """
        raise NotImplementedError()
        # go from public alias -> rpc
        # p = Procssors(parsed_column_name)
        # return [ResolvedColumn()]

    def resolve_column(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext | None]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        # Temporary, this is just to make testing resolve_query easier
        return SPAN_COLUMN_DEFINITIONS[column], None
        # Check if column is an aggregate if so
        # self.resolve_aggregate(column)
        # else
        # self.resolve_attribute(column)

        # Cache the column
        # self.resolved_coluumn[alias] = ResolvedColumn()
        # return ResolvedColumn()
        raise NotImplementedError()

    def get_field_type(self, column: str) -> str:
        resolved_column, _ = self.resolve_column(column)
        return resolved_column.search_type

    def resolve_attributes(
        self, column: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Helper function to resolve a list of attributes instead of 1 attribute at a time"""
        raise NotImplementedError()

    def resolve_attribute(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext]:
        """Attributes are columns that aren't 'functions' or 'aggregates', usually this means string or numeric
        attributes (aka. tags), but can also refer to fields like span.description"""
        raise NotImplementedError()

    def resolve_aggregates(
        self, column: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext]]:
        """Helper function to resolve a list of aggregates instead of 1 attribute at a time"""
        raise NotImplementedError()

    def resolve_aggregate(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext]:
        raise NotImplementedError()
        # Throw error if column is not an aggregate
