from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from re import Match
from typing import Literal, cast

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
    ColumnDefinitions,
    ResolvedColumn,
    ResolvedFormula,
    ResolvedFunction,
    VirtualColumnDefinition,
)
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events import constants as qb_constants
from sentry.search.events import fields
from sentry.search.events import filter as event_filter
from sentry.search.events.types import SnubaParams


@dataclass(frozen=True)
class SearchResolver:
    """The only attributes are things we want to cache and params

    Please do not store any state on the SearchResolver
    """

    params: SnubaParams
    config: SearchResolverConfig
    definitions: ColumnDefinitions
    _resolved_attribute_cache: dict[str, tuple[ResolvedColumn, VirtualColumnDefinition | None]] = (
        field(default_factory=dict)
    )
    _resolved_function_cache: dict[
        str, tuple[ResolvedFunction | ResolvedFormula, VirtualColumnDefinition | None]
    ] = field(default_factory=dict)

    @sentry_sdk.trace
    def resolve_meta(self, referrer: str) -> RequestMeta:
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

        # TODO: replace this with an IN condition when the RPC supports it
        filters = [
            TraceItemFilter(
                comparison_filter=ComparisonFilter(
                    key=resolved_column.proto_definition,
                    op=ComparisonFilter.OP_EQUALS,
                    value=AttributeValue(val_str=environment.name),
                )
            )
            for environment in self.params.environments
            if environment is not None
        ]

        if not filters:
            return None

        return TraceItemFilter(or_filter=OrFilter(filters=filters))

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
        resolved_column: ResolvedColumn | ResolvedFormula | ResolvedFormula,
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

        if not isinstance(resolved_column.proto_definition, AttributeKey):
            raise ValueError(f"{term.key.name} is not valid search term")

        value = term.value.value

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
            if term.operator == "=":
                return (
                    TraceItemFilter(not_filter=NotFilter(filters=[exists_filter]))
                ), context_definition
            else:
                return exists_filter, context_definition

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
        column: ResolvedColumn | ResolvedFormula,
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
        list[ResolvedColumn | ResolvedFunction | ResolvedFormula],
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

    def resolve_column(
        self, column: str, match: Match | None = None
    ) -> tuple[ResolvedColumn | ResolvedFunction | ResolvedFormula, VirtualColumnDefinition | None]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        match = fields.is_function(column)
        if match:
            return self.resolve_aggregate(column, match)
        else:
            return self.resolve_attribute(column)

    def get_field_type(self, column: str) -> str:
        resolved_column, _ = self.resolve_column(column)
        return resolved_column.search_type

    @sentry_sdk.trace
    def resolve_attributes(
        self, columns: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnDefinition | None]]:
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
    ) -> tuple[ResolvedColumn, VirtualColumnDefinition | None]:
        """Attributes are columns that aren't 'functions' or 'aggregates', usually this means string or numeric
        attributes (aka. tags), but can also refer to fields like span.description"""
        # If a virtual context is defined the column definition is always the same
        if column in self._resolved_attribute_cache:
            return self._resolved_attribute_cache[column]
        if column in self.definitions.contexts:
            column_context = self.definitions.contexts[column]
            column_definition = ResolvedColumn(
                public_alias=column, internal_name=column, search_type="string"
            )
        elif column in self.definitions.columns:
            column_context = None
            column_definition = self.definitions.columns[column]
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
            column_definition = ResolvedColumn(
                public_alias=column, internal_name=field, search_type=search_type
            )
            column_context = None

        if column_definition:
            self._resolved_attribute_cache[column] = (column_definition, column_context)
            return self._resolved_attribute_cache[column]
        else:
            raise InvalidSearchQuery(f"Could not parse {column}")

    @sentry_sdk.trace
    def resolve_aggregates(
        self, columns: list[str]
    ) -> tuple[list[ResolvedFunction | ResolvedFormula], list[VirtualColumnDefinition | None]]:
        """Helper function to resolve a list of aggregates instead of 1 attribute at a time"""
        resolved_aggregates, resolved_contexts = [], []
        for column in columns:
            aggregate, context = self.resolve_aggregate(column)
            resolved_aggregates.append(aggregate)
            resolved_contexts.append(context)
        return resolved_aggregates, resolved_contexts

    def resolve_aggregate(
        self, column: str, match: Match | None = None
    ) -> tuple[ResolvedFunction | ResolvedFormula, VirtualColumnDefinition | None]:
        if column in self._resolved_function_cache:
            return self._resolved_function_cache[column]
        # Check if the column looks like a function (matches a pattern), parse the function name and args out
        if match is None:
            match = fields.is_function(column)
            if match is None:
                raise InvalidSearchQuery(f"{column} is not an aggregate")

        function = match.group("function")
        columns = match.group("columns")
        # Alias defaults to the name of the function
        alias = match.group("alias") or column

        # Get the function definition
        if function not in self.definitions.functions:
            raise InvalidSearchQuery(f"Unknown function {function}")
        function_definition = self.definitions.functions[function]

        parsed_columns = []

        # Parse the arguments
        attribute_args = fields.parse_arguments(function, columns)
        if len(attribute_args) < len(function_definition.required_arguments):
            raise InvalidSearchQuery(
                f"Invalid number of arguments for {function}, was expecting {len(function_definition.required_arguments)} arguments"
            )

        for index, argument in enumerate(function_definition.arguments):
            if argument.ignored:
                continue
            elif index < len(attribute_args):
                parsed_argument, _ = self.resolve_attribute(attribute_args[index])
            elif argument.default_arg:
                parsed_argument, _ = self.resolve_attribute(argument.default_arg)
            else:
                raise InvalidSearchQuery(
                    f"Invalid number of arguments for {function}, was expecting {len(function_definition.required_arguments)} arguments"
                )

            if (
                argument.argument_types is not None
                and parsed_argument.search_type not in argument.argument_types
            ):
                raise InvalidSearchQuery(
                    f"{argument} is invalid for {function}, its a {parsed_argument.search_type} type field but {function} expects a field that are one of these types: {argument.argument_types}"
                )
            parsed_columns.append(parsed_argument)

        # Proto doesn't support anything more than 1 argument yet
        if len(parsed_columns) > 1:
            raise InvalidSearchQuery("Cannot use more than one argument")
        elif len(parsed_columns) == 1 and isinstance(
            parsed_columns[0].proto_definition, AttributeKey
        ):
            parsed_column = parsed_columns[0]
            resolved_argument = parsed_column.proto_definition
            search_type = (
                parsed_column.search_type
                if function_definition.infer_search_type_from_arguments
                else function_definition.default_search_type
            )
        else:
            resolved_argument = None
            search_type = function_definition.default_search_type

        resolved_function = function_definition.resolve(alias, search_type, resolved_argument)

        resolved_context = None
        self._resolved_function_cache[column] = (resolved_function, resolved_context)
        return self._resolved_function_cache[column]
