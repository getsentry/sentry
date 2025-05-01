from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from re import Match
from typing import Any, Literal, cast

import sentry_sdk
from parsimonious.exceptions import ParseError
from sentry_protos.snuba.v1.endpoint_trace_item_table_pb2 import (
    AggregationAndFilter,
    AggregationComparisonFilter,
    AggregationFilter,
    AggregationOrFilter,
)
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeAggregation,
    AttributeKey,
    AttributeValue,
    DoubleArray,
    IntArray,
    StrArray,
    VirtualColumnContext,
)
from sentry_protos.snuba.v1.trace_item_filter_pb2 import (
    AndFilter,
    ComparisonFilter,
    ExistsFilter,
    NotFilter,
    OrFilter,
    TraceItemFilter,
)

from sentry.api import event_search
from sentry.exceptions import InvalidSearchQuery
from sentry.search.eap import constants
from sentry.search.eap.columns import (
    AggregateDefinition,
    AttributeArgumentDefinition,
    ColumnDefinitions,
    ConditionalAggregateDefinition,
    FormulaDefinition,
    ResolvedAggregate,
    ResolvedAttribute,
    ResolvedConditionalAggregate,
    ResolvedFormula,
    VirtualColumnDefinition,
)
from sentry.search.eap.spans.attributes import SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.eap.utils import validate_sampling
from sentry.search.events import constants as qb_constants
from sentry.search.events import fields
from sentry.search.events import filter as event_filter
from sentry.search.events.types import SAMPLING_MODES, SnubaParams


@dataclass(frozen=True)
class SearchResolver:
    """The only attributes are things we want to cache and params

    Please do not store any state on the SearchResolver
    """

    params: SnubaParams
    config: SearchResolverConfig
    definitions: ColumnDefinitions
    granularity_secs: int | None = None
    _resolved_attribute_cache: dict[
        str, tuple[ResolvedAttribute, VirtualColumnDefinition | None]
    ] = field(default_factory=dict)
    _resolved_function_cache: dict[
        str,
        tuple[
            ResolvedFormula | ResolvedAggregate | ResolvedConditionalAggregate,
            VirtualColumnDefinition | None,
        ],
    ] = field(default_factory=dict)

    def get_function_definition(
        self, function_name: str
    ) -> ConditionalAggregateDefinition | FormulaDefinition | AggregateDefinition:
        if function_name in self.definitions.aggregates:
            return self.definitions.aggregates[function_name]
        elif function_name in self.definitions.formulas:
            return self.definitions.formulas[function_name]
        elif function_name in self.definitions.conditional_aggregates:
            return self.definitions.conditional_aggregates[function_name]
        else:
            raise InvalidSearchQuery(f"Unknown function {function_name}")

    @sentry_sdk.trace
    def resolve_meta(
        self, referrer: str, sampling_mode: SAMPLING_MODES | None = None
    ) -> RequestMeta:
        if self.params.organization_id is None:
            raise Exception("An organization is required to resolve queries")
        span = sentry_sdk.get_current_span()
        if span:
            span.set_tag("SearchResolver.params", self.params)
        return RequestMeta(
            organization_id=self.params.organization_id,
            referrer=referrer,
            project_ids=self.params.project_ids,
            start_timestamp=self.params.rpc_start_date,
            end_timestamp=self.params.rpc_end_date,
            trace_item_type=self.definitions.trace_item_type,
            downsampled_storage_config=validate_sampling(sampling_mode),
        )

    @sentry_sdk.trace
    def resolve_query(
        self, querystring: str | None
    ) -> tuple[
        TraceItemFilter | None, AggregationFilter | None, list[VirtualColumnDefinition | None]
    ]:
        """Given a query string in the public search syntax eg. `span.description:foo` construct the TraceItemFilter"""
        environment_query = self.__resolve_environment_query()
        where, having, contexts = self.__resolve_query(querystring)
        span = sentry_sdk.get_current_span()
        if span:
            span.set_tag("SearchResolver.query_string", querystring)
            span.set_tag("SearchResolver.resolved_query", where)
            span.set_tag("SearchResolver.environment_query", environment_query)

        # The RPC request meta does not contain the environment.
        # So we have to inject it as a query condition.
        #
        # To do so, we want to AND it with the query.
        # So if either one is not defined, we just use the other.
        # But if both are defined, we AND them together.

        if not environment_query:
            return where, having, contexts

        if not where:
            return environment_query, having, []

        return (
            TraceItemFilter(
                and_filter=AndFilter(
                    filters=[
                        environment_query,
                        where,
                    ]
                )
            ),
            having,
            contexts,
        )

    def __resolve_environment_query(self) -> TraceItemFilter | None:
        resolved_column, _ = self.resolve_column("environment")
        if not isinstance(resolved_column.proto_definition, AttributeKey):
            return None

        envs = [env.name for env in self.params.environments if env is not None]

        if not envs:
            return None

        return TraceItemFilter(
            comparison_filter=ComparisonFilter(
                key=resolved_column.proto_definition,
                op=ComparisonFilter.OP_IN,
                value=AttributeValue(val_str_array=StrArray(values=envs)),
            )
        )

    def __resolve_query(
        self, querystring: str | None
    ) -> tuple[
        TraceItemFilter | None, AggregationFilter | None, list[VirtualColumnDefinition | None]
    ]:
        if querystring is None:
            return None, None, []
        try:
            parsed_terms = event_search.parse_search_query(
                querystring,
                config=event_search.SearchConfig.create_from(
                    event_search.default_config,
                    wildcard_free_text=True,
                ),
                params=self.params.filter_params,
                get_field_type=self.get_field_type,
                get_function_result_type=self.get_field_type,
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
    ) -> tuple[
        TraceItemFilter | None, AggregationFilter | None, list[VirtualColumnDefinition | None]
    ]:
        if len(terms) == 0:
            return None, None, []
        elif len(terms) == 1:
            if isinstance(terms[0], event_search.ParenExpression):
                return self._resolve_boolean_conditions(terms[0].children)
            elif isinstance(terms[0], event_search.SearchFilter):
                return self._resolve_terms([cast(event_search.SearchFilter, terms[0])])
            elif isinstance(terms[0], event_search.AggregateFilter):
                return self._resolve_terms([cast(event_search.AggregateFilter, terms[0])])
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
        try:
            index = terms.index(event_search.SearchBoolean.BOOLEAN_OR)
            lhs, rhs = terms[:index], terms[index + 1 :]
            operator: Literal["and" | "or"] = "or"
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = "and"

        where_lhs, having_lhs, contexts_lhs = self._resolve_boolean_conditions(lhs)
        where_rhs, having_rhs, contexts_rhs = self._resolve_boolean_conditions(rhs)
        contexts = contexts_lhs + contexts_rhs

        where = None
        having = None

        if where_lhs is not None and where_rhs is not None:
            if operator == "and":
                where = TraceItemFilter(and_filter=AndFilter(filters=[where_lhs, where_rhs]))
            else:
                where = TraceItemFilter(or_filter=OrFilter(filters=[where_lhs, where_rhs]))
        elif where_lhs is None and where_rhs is not None:
            where = where_rhs
        elif where_lhs is not None and where_rhs is None:
            where = where_lhs

        if having_lhs is not None and having_rhs is not None:
            if operator == "and":
                having = AggregationFilter(
                    and_filter=AggregationAndFilter(filters=[having_lhs, having_rhs])
                )
            else:
                having = AggregationFilter(
                    or_filter=AggregationOrFilter(filters=[having_lhs, having_rhs])
                )
        elif having_lhs is None and having_rhs is not None:
            having = having_rhs
        elif having_lhs is not None and having_rhs is None:
            having = having_lhs

        return where, having, contexts

    def _resolve_terms(
        self, terms: event_filter.ParsedTerms
    ) -> tuple[
        TraceItemFilter | None, AggregationFilter | None, list[VirtualColumnDefinition | None]
    ]:
        where, where_contexts = self._resolve_where(terms)
        having, having_contexts = self._resolve_having(terms)
        return where, having, where_contexts + having_contexts

    def _resolve_where(
        self, terms: event_filter.ParsedTerms
    ) -> tuple[TraceItemFilter | None, list[VirtualColumnDefinition | None]]:
        parsed_terms = []
        resolved_contexts = []
        for item in terms:
            if isinstance(item, event_search.SearchFilter):
                resolved_term, resolved_context = self.resolve_term(
                    cast(event_search.SearchFilter, item)
                )
                parsed_terms.append(resolved_term)
                resolved_contexts.append(resolved_context)

        if len(parsed_terms) > 1:
            return TraceItemFilter(and_filter=AndFilter(filters=parsed_terms)), resolved_contexts
        elif len(parsed_terms) == 1:
            return parsed_terms[0], resolved_contexts
        return None, []

    def _resolve_having(
        self, terms: event_filter.ParsedTerms
    ) -> tuple[AggregationFilter | None, list[VirtualColumnDefinition | None]]:
        if not self.config.use_aggregate_conditions:
            return None, []

        parsed_terms = []
        resolved_contexts = []
        for item in terms:
            if isinstance(item, event_search.AggregateFilter):
                resolved_term, resolved_context = self.resolve_aggregate_term(
                    cast(event_search.AggregateFilter, item)
                )
                parsed_terms.append(resolved_term)
                resolved_contexts.append(resolved_context)

        if len(parsed_terms) > 1:
            return (
                AggregationFilter(and_filter=AggregationAndFilter(filters=parsed_terms)),
                resolved_contexts,
            )
        elif len(parsed_terms) == 1:
            return parsed_terms[0], resolved_contexts
        return None, []

    def resolve_virtual_context_term(
        self,
        term: str,
        raw_value: str | list[str],
        resolved_column: ResolvedAttribute,
        context: VirtualColumnDefinition,
    ) -> list[str] | str:
        # Convert the term to the expected values
        final_raw_value: str | list[str] = []
        resolved_context = context.constructor(self.params)
        reversed_context = {v: k for k, v in resolved_context.value_map.items()}
        if isinstance(raw_value, list):
            new_value = []
            for raw_iterable in raw_value:
                if context.default_value and context.default_value == raw_iterable:
                    # Avoiding this for now, while this could work with the Unknown:"" mapping
                    # But that won't work once we use the VirtualColumnContext.default_value
                    raise InvalidSearchQuery(
                        f"Using {raw_iterable} in an IN filter is not currently supported"
                    )
                elif raw_iterable not in reversed_context:
                    valid_values = list(reversed_context.keys())[:5]
                    if len(valid_values) > 5:
                        valid_values.append("...")
                    raise InvalidSearchQuery(
                        constants.REVERSE_CONTEXT_ERROR.format(
                            raw_value, term, ", ".join(valid_values)
                        )
                    )
                else:
                    new_value.append(reversed_context[raw_iterable])
            final_raw_value = new_value
        elif raw_value in reversed_context:
            final_raw_value = reversed_context[raw_value]
        elif context.default_value and context.default_value == raw_value:
            # Avoiding this for now, while this could work with the Unknown:"" mapping
            # But that won't work once we use the VirtualColumnContext.default_value
            raise InvalidSearchQuery(f"Using {raw_value} is not currently supported")
        else:
            valid_values = list(reversed_context.keys())[:5]
            if len(valid_values) > 5:
                valid_values.append("...")
            raise InvalidSearchQuery(
                constants.REVERSE_CONTEXT_ERROR.format(
                    raw_value, term, ", ".join(list(reversed_context.keys())[:5])
                )
            )
        return final_raw_value

    def resolve_term(
        self, term: event_search.SearchFilter
    ) -> tuple[TraceItemFilter, VirtualColumnDefinition | None]:
        resolved_column, context_definition = self.resolve_column(term.key.name)

        value = term.value.value
        if self.params.is_timeseries_request and context_definition is not None:
            resolved_column, value = self.map_search_term_context_to_original_column(
                term, context_definition
            )
            context_definition = None

        if not isinstance(resolved_column.proto_definition, AttributeKey):
            raise ValueError(f"{term.key.name} is not valid search term")

        if context_definition:
            if term.value.is_wildcard():
                # Avoiding this for now, but we could theoretically do a wildcard search on the resolved contexts
                raise InvalidSearchQuery(f"Cannot use wildcards with {term.key.name}")
            if (
                isinstance(value, str)
                or isinstance(value, list)
                and all(isinstance(iter_value, str) for iter_value in value)
            ):
                value = self.resolve_virtual_context_term(
                    term.key.name,
                    value,
                    resolved_column,
                    context_definition,
                )
            else:
                raise InvalidSearchQuery(f"{value} not a valid term for {term.key.name}")
            if context_definition.term_resolver:
                value = context_definition.term_resolver(value)
            if context_definition.filter_column is not None:
                resolved_column, _ = self.resolve_attribute(context_definition.filter_column)

        if term.value.is_wildcard():
            if term.operator == "=":
                operator = ComparisonFilter.OP_LIKE
            elif term.operator == "!=":
                operator = ComparisonFilter.OP_NOT_LIKE
            else:
                raise InvalidSearchQuery(f"Cannot use a wildcard with a {term.operator} filter")
            value = str(term.value.raw_value)
            value = event_search.translate_wildcard_as_clickhouse_pattern(value)
        elif term.operator in constants.OPERATOR_MAP:
            operator = constants.OPERATOR_MAP[term.operator]
        else:
            raise InvalidSearchQuery(f"Unknown operator: {term.operator}")

        if value == "" and context_definition is None:
            exists_filter = TraceItemFilter(
                exists_filter=ExistsFilter(
                    key=resolved_column.proto_definition,
                )
            )
            if term.operator == "!=":
                filters = [exists_filter]
                if resolved_column.proto_definition.type == constants.STRING:
                    filters.append(
                        TraceItemFilter(
                            comparison_filter=ComparisonFilter(
                                key=resolved_column.proto_definition,
                                op=operator,
                                value=self._resolve_search_value(
                                    resolved_column, term.operator, value
                                ),
                            )
                        )
                    )
                return (
                    TraceItemFilter(and_filter=AndFilter(filters=filters)),
                    context_definition,
                )
            elif term.operator == "=":
                filters = [TraceItemFilter(not_filter=NotFilter(filters=[exists_filter]))]
                if resolved_column.proto_definition.type == constants.STRING:
                    filters.append(
                        TraceItemFilter(
                            comparison_filter=ComparisonFilter(
                                key=resolved_column.proto_definition,
                                op=operator,
                                value=self._resolve_search_value(
                                    resolved_column, term.operator, value
                                ),
                            )
                        )
                    )
                return (
                    TraceItemFilter(or_filter=OrFilter(filters=filters)),
                    context_definition,
                )
            else:
                raise InvalidSearchQuery(f"Unsupported operator for empty strings {term.operator}")

        return (
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=resolved_column.proto_definition,
                    op=operator,
                    value=self._resolve_search_value(resolved_column, term.operator, value),
                )
            ),
            context_definition,
        )

    def map_context_to_original_column(
        self,
        context_definition: VirtualColumnDefinition,
    ) -> ResolvedAttribute:
        """
        Time series request do not support virtual column contexts, so we have to remap the value back to the original column.
        (see https://github.com/getsentry/eap-planning/issues/236)
        """
        context = context_definition.constructor(self.params)

        is_number_column = (
            context.from_column_name in SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS["number"]
        )

        public_alias = (
            SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS["number"].get(context.from_column_name)
            if is_number_column
            else context.from_column_name
        )

        if public_alias is None:
            raise InvalidSearchQuery(f"Cannot map {context.from_column_name} to a public alias")

        resolved_column, _ = self.resolve_column(public_alias)

        if not isinstance(resolved_column.proto_definition, AttributeKey):
            raise ValueError(f"{resolved_column.public_alias} is not valid search term")

        return resolved_column

    def map_search_term_context_to_original_column(
        self,
        term: event_search.SearchFilter,
        context_definition: VirtualColumnDefinition,
    ) -> tuple[ResolvedAttribute, str | int | list[str]]:
        """
        Time series request do not support virtual column contexts, so we have to remap the value back to the original column.
        (see https://github.com/getsentry/eap-planning/issues/236)
        """
        context = context_definition.constructor(self.params)
        is_number_column = (
            context.from_column_name in SPANS_INTERNAL_TO_PUBLIC_ALIAS_MAPPINGS["number"]
        )

        resolved_column = self.map_context_to_original_column(context_definition)

        value = term.value.value

        inverse_value_map: dict[str, list[str]] = {}
        for key, val in context.value_map.items():
            inverse_value_map[val] = inverse_value_map.get(val, []) + [key]

        def remap_value(old_value: str) -> list[str]:
            if old_value in inverse_value_map:
                return inverse_value_map[old_value]
            elif context.default_value:
                return [context.default_value]
            else:
                raise InvalidSearchQuery(f"Unknown value {old_value}")

        final_value: list[str] = []
        if isinstance(value, list):
            value_set: set[str] = set()
            for v in value:
                for mapped_values in remap_value(v):
                    value_set.add(mapped_values)

            final_value = list(value_set)

        else:
            final_value = remap_value(value)

        if len(final_value) == 1 and not isinstance(value, list):
            if is_number_column:
                return resolved_column, int(final_value[0])
            return resolved_column, final_value[0]

        return resolved_column, final_value

    def resolve_aggregate_term(
        self, term: event_search.AggregateFilter
    ) -> tuple[AggregationFilter, VirtualColumnDefinition | None]:
        resolved_column, context = self.resolve_column(term.key.name)

        if not isinstance(resolved_column.proto_definition, AttributeAggregation):
            raise ValueError(f"{term.key.name} is not valid search term")

        # TODO: Handle different units properly
        value = term.value.value

        if term.operator in constants.OPERATOR_MAP:
            operator = constants.AGGREGATION_OPERATOR_MAP[term.operator]
        else:
            raise InvalidSearchQuery(f"Unknown operator: {term.operator}")

        return (
            AggregationFilter(
                comparison_filter=AggregationComparisonFilter(
                    aggregation=resolved_column.proto_definition,
                    op=operator,
                    val=value,
                ),
            ),
            context,
        )

    def _resolve_search_value(
        self,
        column: ResolvedAttribute,
        operator: str,
        value: str | float | datetime | Sequence[float] | Sequence[str],
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
                # The search parser will always convert a value to a float, so we need to cast back to an int
                if operator in constants.IN_OPERATORS:
                    if isinstance(value, list):
                        return AttributeValue(
                            val_int_array=IntArray(values=[int(val) for val in value])
                        )
                    else:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid value for doing an IN filter"
                        )
                elif isinstance(value, (float, int)):
                    return AttributeValue(val_int=int(value))
            elif column_type == constants.DOUBLE:
                if operator in constants.IN_OPERATORS:
                    if isinstance(value, list):
                        return AttributeValue(
                            val_double_array=DoubleArray(values=[val for val in value])
                        )
                    else:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid value for doing an IN filter"
                        )
                elif isinstance(value, float):
                    return AttributeValue(val_double=value)
            elif column_type == constants.BOOLEAN:
                if operator in constants.IN_OPERATORS:
                    raise InvalidSearchQuery(
                        f"{column.public_alias} cannot be used with an IN filter"
                    )
                elif isinstance(value, str):
                    lowered_value = value.lower()
                    if lowered_value not in constants.BOOLEAN_VALUES:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid boolean value, expecting true or false"
                        )
                    bool_value = lowered_value in constants.TRUTHY_VALUES
                    return AttributeValue(val_bool=bool_value)
            raise InvalidSearchQuery(
                f"{value} is not a valid filter value for {column.public_alias}, expecting {constants.TYPE_TO_STRING_MAP[column_type]}, but got a {type(value)}"
            )
        else:
            raise NotImplementedError("Aggregate Queries not implemented yet")

    def resolve_contexts(
        self, context_definitions: list[VirtualColumnDefinition | None]
    ) -> list[VirtualColumnContext]:
        """Given a list of contexts that may have None in them, remove the Nones and remove the dupes"""
        final_contexts = []
        existing_target_columns = set()
        for context_definition in context_definitions:
            if context_definition is None:
                continue
            context = context_definition.constructor(self.params)
            if context is None or context.to_column_name in existing_target_columns:
                continue
            else:
                existing_target_columns.add(context.to_column_name)
                final_contexts.append(context)
        return final_contexts

    @sentry_sdk.trace
    def resolve_columns(self, selected_columns: list[str]) -> tuple[
        list[
            ResolvedAttribute | ResolvedAggregate | ResolvedConditionalAggregate | ResolvedFormula
        ],
        list[VirtualColumnDefinition | None],
    ]:
        """Given a list of columns resolve them and get their context if applicable

        This function will also dedupe the virtual column contexts if necessary
        """
        span = sentry_sdk.get_current_span()
        resolved_columns = []
        resolved_contexts = []
        stripped_columns = [column.strip() for column in selected_columns]
        if span:
            span.set_tag("SearchResolver.selected_columns", stripped_columns)
        has_aggregates = False
        for column in stripped_columns:
            match = fields.is_function(column)
            has_aggregates = has_aggregates or match is not None
            resolved_column, context = self.resolve_column(column, match)
            resolved_columns.append(resolved_column)
            resolved_contexts.append(context)

        if self.config.auto_fields:
            # Ensure fields we require to build a functioning interface are present.
            if not has_aggregates and "id" not in stripped_columns:
                id_column, id_context = self.resolve_column("id")
                resolved_columns.append(id_column)
                resolved_contexts.append(id_context)
                stripped_columns.append("id")
            if "id" in stripped_columns and "project.id" not in stripped_columns:
                project_column, project_context = self.resolve_column("project.name")
                resolved_columns.append(project_column)
                resolved_contexts.append(project_context)

        return resolved_columns, resolved_contexts

    def resolve_column(self, column: str, match: Match | None = None) -> tuple[
        ResolvedAttribute | ResolvedAggregate | ResolvedConditionalAggregate | ResolvedFormula,
        VirtualColumnDefinition | None,
    ]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        match = fields.is_function(column)
        if match:
            return self.resolve_function(column, match)
        else:
            return self.resolve_attribute(column)

    def get_field_type(self, column: str) -> str:
        resolved_column, _ = self.resolve_column(column)
        return resolved_column.search_type

    @sentry_sdk.trace
    def resolve_attributes(
        self, columns: list[str]
    ) -> tuple[list[ResolvedAttribute], list[VirtualColumnDefinition | None]]:
        """Helper function to resolve a list of attributes instead of 1 attribute at a time"""
        resolved_columns = []
        resolved_contexts = []
        for column in columns:
            col, context = self.resolve_attribute(column)
            resolved_columns.append(col)
            resolved_contexts.append(context)
        return resolved_columns, resolved_contexts

    def resolve_attribute(
        self, column: str
    ) -> tuple[ResolvedAttribute, VirtualColumnDefinition | None]:
        """Attributes are columns that aren't 'functions' or 'aggregates', usually this means string or numeric
        attributes (aka. tags), but can also refer to fields like span.description"""
        # If a virtual context is defined the column definition is always the same
        if column in self._resolved_attribute_cache:
            return self._resolved_attribute_cache[column]
        if column in self.definitions.contexts:
            column_context = self.definitions.contexts[column]
            column_definition = ResolvedAttribute(
                public_alias=column,
                internal_name=column,
                search_type="string",
                processor=column_context.processor,
            )
        elif column in self.definitions.columns:
            column_context = None
            column_definition = self.definitions.columns[column]
            if column_definition.private and column not in self.config.fields_acl.attributes:
                raise InvalidSearchQuery(f"The field {column} is not allowed for this query")
        else:
            if len(column) > qb_constants.MAX_TAG_KEY_LENGTH:
                raise InvalidSearchQuery(
                    f"{column} is too long, can be a maximum of 200 characters"
                )

            tag_match = qb_constants.TYPED_TAG_KEY_RE.search(column)
            if tag_match is None:
                tag_match = qb_constants.TAG_KEY_RE.search(column)
                field_type = "string"
            else:
                field_type = None
            field = tag_match.group("tag") if tag_match else column
            if field is None:
                raise InvalidSearchQuery(f"Could not parse {column}")
            # Assume string if a type isn't passed. eg. tags[foo]
            if field_type is None:
                field_type = tag_match.group("type") if tag_match else None

            if field_type not in constants.TYPE_MAP:
                raise InvalidSearchQuery(f"Unsupported type {field_type} in {column}")

            if column.startswith("sentry_tags"):
                field = f"sentry.{field}"

            search_type = cast(constants.SearchType, field_type)
            column_definition = ResolvedAttribute(
                public_alias=column, internal_name=field, search_type=search_type
            )
            column_context = None

        if column_definition:
            self._resolved_attribute_cache[column] = (column_definition, column_context)
            return self._resolved_attribute_cache[column]
        else:
            raise InvalidSearchQuery(f"Could not parse {column}")

    @sentry_sdk.trace
    def resolve_functions(self, columns: list[str]) -> tuple[
        list[ResolvedFormula | ResolvedAggregate | ResolvedConditionalAggregate],
        list[VirtualColumnDefinition | None],
    ]:
        """Helper function to resolve a list of functions instead of 1 attribute at a time"""
        resolved_functions, resolved_contexts = [], []
        for column in columns:
            function, context = self.resolve_function(column)
            resolved_functions.append(function)
            resolved_contexts.append(context)
        return resolved_functions, resolved_contexts

    def resolve_function(self, column: str, match: Match | None = None) -> tuple[
        ResolvedFormula | ResolvedAggregate | ResolvedConditionalAggregate,
        VirtualColumnDefinition | None,
    ]:
        if column in self._resolved_function_cache:
            return self._resolved_function_cache[column]
        # Check if the column looks like a function (matches a pattern), parse the function name and args out
        if match is None:
            match = fields.is_function(column)
            if match is None:
                raise InvalidSearchQuery(f"{column} is not a function")

        function_name = match.group("function")
        columns = match.group("columns")
        # Alias defaults to the name of the function
        alias = match.group("alias") or column

        function_definition = self.get_function_definition(function_name)
        if function_definition.private and function_name not in self.config.fields_acl.functions:
            raise InvalidSearchQuery(f"The function {function_name} is not allowed for this query")

        parsed_args: list[ResolvedAttribute | Any] = []

        # Parse the arguments
        arguments = fields.parse_arguments(function_name, columns)
        if len(arguments) < len(function_definition.required_arguments):
            raise InvalidSearchQuery(
                f"Invalid number of arguments for {function_name}, was expecting {len(function_definition.required_arguments)} arguments"
            )

        for index, argument_definition in enumerate(function_definition.arguments):
            if argument_definition.ignored:
                continue

            if index < len(arguments):
                argument = arguments[index]
                if argument_definition.validator is not None:
                    if not argument_definition.validator(argument):
                        raise InvalidSearchQuery(
                            f"{argument} is not a valid argument for {function_name}"
                        )
                if isinstance(argument_definition, AttributeArgumentDefinition):
                    parsed_argument, _ = self.resolve_attribute(argument)
                else:
                    if argument_definition.argument_types is None:
                        parsed_args.append(argument)  # assume it's a string
                        continue
                    # TODO: we assume that the argument is only one type for now, and we only support string/integer
                    for type in argument_definition.argument_types:
                        if type == "integer":
                            parsed_args.append(int(argument))
                        if type == "number":
                            parsed_args.append(float(argument))
                        else:
                            parsed_args.append(argument)
                    continue

            elif argument_definition.default_arg:
                parsed_argument, _ = self.resolve_attribute(argument_definition.default_arg)
            else:
                raise InvalidSearchQuery(
                    f"Invalid number of arguments for {function_name}, was expecting {len(function_definition.required_arguments)} arguments"
                )

            if (
                isinstance(argument_definition, AttributeArgumentDefinition)
                and argument_definition.attribute_types is not None
                and parsed_argument.search_type not in argument_definition.attribute_types
            ):
                raise InvalidSearchQuery(
                    f"{parsed_argument.public_alias} is invalid for parameter {index+1} in {function_name}. Its a {parsed_argument.search_type} type field, but it must be one of these types: {argument_definition.attribute_types}"
                )
            parsed_args.append(parsed_argument)

        resolved_arguments = []
        for parsed_arg in parsed_args:
            if not isinstance(parsed_arg, ResolvedAttribute):
                resolved_argument = parsed_arg
                search_type = function_definition.default_search_type
            elif isinstance(parsed_arg.proto_definition, AttributeKey):
                resolved_argument = parsed_arg.proto_definition
            resolved_arguments.append(resolved_argument)

        # We assume the first argument contains the resolved search_type as this is always the case for now
        if len(parsed_args) == 0 or not isinstance(parsed_args[0], ResolvedAttribute):
            search_type = function_definition.default_search_type
        else:
            search_type = (
                parsed_args[0].search_type
                if function_definition.infer_search_type_from_arguments
                else function_definition.default_search_type
            )

        resolved_function = function_definition.resolve(
            alias=alias,
            search_type=search_type,
            resolved_arguments=resolved_arguments,
            snuba_params=self.params,
        )

        resolved_context = None
        self._resolved_function_cache[column] = (resolved_function, resolved_context)
        return self._resolved_function_cache[column]
