from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from re import Match
from typing import cast

from parsimonious.exceptions import ParseError
from sentry_protos.snuba.v1.request_common_pb2 import RequestMeta
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import (
    AttributeKey,
    AttributeValue,
    FloatArray,
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
from sentry.search.eap.columns import (
    SPAN_COLUMN_DEFINITIONS,
    SPAN_FUNCTION_DEFINITIONS,
    VIRTUAL_CONTEXTS,
    ResolvedColumn,
    ResolvedFunction,
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
    resolved_columns: dict[str, ResolvedColumn] = field(default_factory=dict)

    def resolve_meta(self, referrer: str) -> RequestMeta:
        if self.params.organization_id is None:
            raise Exception("An organization is required to resolve queries")
        return RequestMeta(
            organization_id=self.params.organization_id,
            referrer=referrer,
            project_ids=self.params.project_ids,
            start_timestamp=self.params.rpc_start_date,
            end_timestamp=self.params.rpc_end_date,
        )

    def resolve_query(self, querystring: str | None) -> TraceItemFilter | None:
        """Given a query string in the public search syntax eg. `span.description:foo` construct the TraceItemFilter"""
        if querystring is None:
            return None
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
                raw_value = item.value.raw_value
                if item.value.is_wildcard():
                    if item.operator == "=":
                        operator = ComparisonFilter.OP_LIKE
                    elif item.operator == "!=":
                        operator = ComparisonFilter.OP_NOT_LIKE
                    else:
                        raise InvalidSearchQuery(
                            f"Cannot use a wildcard with a {item.operator} filter"
                        )
                    # Slashes have to be double escaped so they are
                    # interpreted as a string literal.
                    raw_value = (
                        str(item.value.raw_value)
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_")
                        .replace("*", "%")
                    )
                elif item.operator in constants.OPERATOR_MAP:
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
                                    resolved_column, item.operator, raw_value
                                ),
                            )
                        )
                    )
                else:
                    raise NotImplementedError("Can't filter on aggregates yet")
            else:
                if self.config.use_aggregate_conditions:
                    raise NotImplementedError("Can't filter on aggregates yet")

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
                elif isinstance(value, float):
                    return AttributeValue(val_int=int(value))
            elif column_type == constants.FLOAT:
                if operator in constants.IN_OPERATORS:
                    if isinstance(value, list):
                        return AttributeValue(
                            val_float_array=FloatArray(values=[val for val in value])
                        )
                    else:
                        raise InvalidSearchQuery(
                            f"{value} is not a valid value for doing an IN filter"
                        )
                elif isinstance(value, float):
                    return AttributeValue(val_float=value)
            raise InvalidSearchQuery(
                f"{value} is not a valid filter value for {column.public_alias}"
            )
        else:
            raise NotImplementedError("Aggregate Queries not implemented yet")

    def clean_contexts(
        self, resolved_contexts: list[VirtualColumnContext | None]
    ) -> list[VirtualColumnContext]:
        """Given a list of contexts that may have None in them, remove the Nones and remove the dupes"""
        final_contexts = []
        existing_target_columns = set()
        for context in resolved_contexts:
            if context is None or context.to_column_name in existing_target_columns:
                continue
            else:
                existing_target_columns.add(context.to_column_name)
                final_contexts.append(context)
        return final_contexts

    def resolve_columns(
        self, selected_columns: list[str]
    ) -> tuple[list[ResolvedColumn | ResolvedFunction], list[VirtualColumnContext]]:
        """Given a list of columns resolve them and get their context if applicable

        This function will also dedupe the virtual column contexts if necessary
        """
        resolved_columns = []
        resolved_contexts = []
        stripped_columns = [column.strip() for column in selected_columns]
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

        return resolved_columns, self.clean_contexts(resolved_contexts)

    def resolve_column(
        self, column: str, match: Match | None = None
    ) -> tuple[ResolvedColumn | ResolvedFunction, VirtualColumnContext | None]:
        """Column is either an attribute or an aggregate, this function will determine which it is and call the relevant
        resolve function"""
        match = fields.is_function(column)
        if match:
            return self.resolve_aggregate(column, match)
        else:
            return self.resolve_attribute(column)

        # TODO: Cache the column
        # self.resolved_coluumn[alias] = ResolvedColumn()
        # return ResolvedColumn()

    def get_field_type(self, column: str) -> str:
        resolved_column, _ = self.resolve_column(column)
        return resolved_column.search_type

    def resolve_attributes(
        self, columns: list[str]
    ) -> tuple[list[ResolvedColumn], list[VirtualColumnContext | None]]:
        """Helper function to resolve a list of attributes instead of 1 attribute at a time"""
        resolved_columns = []
        resolved_contexts = []
        for column in columns:
            col, context = self.resolve_attribute(column)
            resolved_columns.append(col)
            resolved_contexts.append(context)
        return resolved_columns, resolved_contexts

    def resolve_attribute(self, column: str) -> tuple[ResolvedColumn, VirtualColumnContext | None]:
        """Attributes are columns that aren't 'functions' or 'aggregates', usually this means string or numeric
        attributes (aka. tags), but can also refer to fields like span.description"""
        # If a virtual context is defined the column definition is always the same
        if column in VIRTUAL_CONTEXTS:
            column_context = VIRTUAL_CONTEXTS[column](self.params)
            column_definition = ResolvedColumn(
                public_alias=column, internal_name=column, search_type="string"
            )
        elif column in SPAN_COLUMN_DEFINITIONS:
            column_context = None
            column_definition = SPAN_COLUMN_DEFINITIONS[column]
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

            column_definition = ResolvedColumn(
                public_alias=column, internal_name=field, search_type=field_type
            )
            column_context = None

        if column_definition:
            return column_definition, column_context
        else:
            raise InvalidSearchQuery(f"Could not parse {column}")

    def resolve_aggregates(
        self, columns: list[str]
    ) -> tuple[list[ResolvedFunction], list[VirtualColumnContext | None]]:
        """Helper function to resolve a list of aggregates instead of 1 attribute at a time"""
        resolved_aggregates, resolved_contexts = [], []
        for column in columns:
            aggregate, context = self.resolve_aggregate(column)
            resolved_aggregates.append(aggregate)
            resolved_contexts.append(context)
        return resolved_aggregates, resolved_contexts

    def resolve_aggregate(
        self, column: str, match: Match | None = None
    ) -> tuple[ResolvedFunction, VirtualColumnContext | None]:
        # Check if this is a valid function, parse the function name and args out
        if match is None:
            match = fields.is_function(column)
            if match is None:
                raise InvalidSearchQuery(f"{column} is not an aggregate")

        function = match.group("function")
        columns = match.group("columns")
        # Alias defaults to the name of the function
        alias = match.group("alias") or column

        # Get the function definition
        if function not in SPAN_FUNCTION_DEFINITIONS:
            raise InvalidSearchQuery(f"Unknown function {function}")
        function_definition = SPAN_FUNCTION_DEFINITIONS[function]

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
            if index < len(attribute_args):
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
        elif len(parsed_columns) == 1:
            resolved_argument = (
                parsed_columns[0].proto_definition
                if isinstance(parsed_columns[0].proto_definition, AttributeKey)
                else None
            )
        else:
            resolved_argument = None

        return (
            ResolvedFunction(
                public_alias=alias,
                internal_name=function_definition.internal_function,
                search_type=function_definition.search_type,
                internal_type=function_definition.internal_type,
                processor=function_definition.processor,
                extrapolation=function_definition.extrapolation,
                argument=resolved_argument,
            ),
            None,
        )
