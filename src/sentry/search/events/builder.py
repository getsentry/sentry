from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Mapping, Match, Optional, Set, Tuple, Union, cast

import sentry_sdk
from django.utils.functional import cached_property
from parsimonious.exceptions import ParseError  # type: ignore
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, BooleanCondition, Condition, Op, Or
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset, Turbo
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Query

from sentry.api.event_search import (
    AggregateFilter,
    ParenExpression,
    SearchBoolean,
    SearchFilter,
    SearchKey,
    SearchValue,
    parse_search_query,
)
from sentry.discover.arithmetic import (
    OperandType,
    Operation,
    categorize_columns,
    is_equation_alias,
    resolve_equation_list,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models import Organization
from sentry.models.project import Project
from sentry.search.events.constants import (
    ARRAY_FIELDS,
    EQUALITY_OPERATORS,
    METRICS_MAX_LIMIT,
    NO_CONVERSION_FIELDS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    TAG_KEY_RE,
    TIMESTAMP_FIELDS,
    VALID_FIELD_PATTERN,
)
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.fields import (
    ColumnArg,
    FunctionDetails,
    MetricsFunction,
    NormalizedArg,
    NumericColumn,
    SnQLArrayCombinator,
    SnQLFunction,
    get_function_alias_with_columns,
    is_function,
    parse_arguments,
    parse_combinator,
)
from sentry.search.events.filter import ParsedTerm, ParsedTerms
from sentry.search.events.types import (
    HistogramParams,
    ParamsType,
    QueryFramework,
    SelectType,
    WhereType,
)
from sentry.sentry_metrics import indexer
from sentry.utils.dates import outside_retention_with_modified_start, to_timestamp
from sentry.utils.snuba import (
    Dataset,
    QueryOutsideRetentionError,
    bulk_snql_query,
    raw_snql_query,
    resolve_column,
)
from sentry.utils.validators import INVALID_ID_DETAILS, INVALID_SPAN_ID, WILDCARD_NOT_ALLOWED


class QueryBuilder:
    """Builds a snql query"""

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        auto_fields: bool = False,
        auto_aggregations: bool = False,
        use_aggregate_conditions: bool = False,
        functions_acl: Optional[List[str]] = None,
        array_join: Optional[str] = None,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
        limitby: Optional[Tuple[str, int]] = None,
        turbo: bool = False,
        sample_rate: Optional[float] = None,
        equation_config: Optional[Dict[str, bool]] = None,
        granularity: Optional[int] = None,
    ):
        self.dataset = dataset
        self.params = params
        self.auto_fields = auto_fields
        self.functions_acl = set() if functions_acl is None else functions_acl
        self.equation_config = {} if equation_config is None else equation_config

        # Function is a subclass of CurriedFunction
        self.where: List[WhereType] = []
        self.having: List[WhereType] = []
        # The list of aggregates to be selected
        self.aggregates: List[CurriedFunction] = []
        self.columns: List[SelectType] = []
        self.orderby: List[OrderBy] = []
        self.groupby: List[SelectType] = []
        self.projects_to_filter: Set[int] = set()
        self.function_alias_map: Dict[str, FunctionDetails] = {}

        self.auto_aggregations = auto_aggregations
        self.limit = self.resolve_limit(limit)
        self.offset = None if offset is None else Offset(offset)
        self.turbo = Turbo(turbo)
        self.sample_rate = sample_rate

        self.resolve_column_name = resolve_column(self.dataset)

        (
            self.field_alias_converter,
            self.function_converter,
            self.search_filter_converter,
        ) = self.load_config()

        self.limitby = self.resolve_limitby(limitby)
        self.array_join = None if array_join is None else [self.resolve_column(array_join)]

        self.resolve_query(
            query=query,
            use_aggregate_conditions=use_aggregate_conditions,
            selected_columns=selected_columns,
            equations=equations,
            orderby=orderby,
            granularity=granularity,
        )

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        granularity: Optional[int] = None,
    ) -> None:
        self.where, self.having = self.resolve_conditions(
            query, use_aggregate_conditions=use_aggregate_conditions
        )
        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)
        self.orderby = self.resolve_orderby(orderby)
        self.groupby = self.resolve_groupby()
        self.granularity = self.resolve_granularity(granularity)

    def load_config(
        self,
    ) -> Tuple[
        Mapping[str, Callable[[str], SelectType]],
        Mapping[str, SnQLFunction],
        Mapping[str, Callable[[SearchFilter], Optional[WhereType]]],
    ]:
        from sentry.search.events.datasets.discover import DiscoverDatasetConfig
        from sentry.search.events.datasets.metrics import MetricsDatasetConfig
        from sentry.search.events.datasets.sessions import SessionsDatasetConfig

        self.config: DatasetConfig
        if self.dataset in [Dataset.Discover, Dataset.Transactions, Dataset.Events]:
            self.config = DiscoverDatasetConfig(self)
        elif self.dataset == Dataset.Sessions:
            self.config = SessionsDatasetConfig(self)
        elif self.dataset == Dataset.Metrics:
            self.config = MetricsDatasetConfig(self)
        else:
            raise NotImplementedError(f"Data Set configuration not found for {self.dataset}.")

        field_alias_converter = self.config.field_alias_converter
        function_converter = self.config.function_converter
        search_filter_converter = self.config.search_filter_converter

        return field_alias_converter, function_converter, search_filter_converter

    def resolve_granularity(self, _: Optional[int] = None) -> Optional[Granularity]:
        return None

    def resolve_limit(self, limit: Optional[int]) -> Optional[Limit]:
        return None if limit is None else Limit(limit)

    def resolve_limitby(self, limitby: Optional[Tuple[str, int]]) -> Optional[LimitBy]:
        if limitby is None:
            return None

        column, count = limitby
        resolved = self.resolve_column(column)

        if isinstance(resolved, Column):
            return LimitBy([resolved], count)

        # TODO: Limit By can only operate on a `Column`. This has the implication
        # that non aggregate transforms are not allowed in the order by clause.
        raise InvalidSearchQuery(f"{column} used in a limit by but is not a column.")

    def resolve_where(self, parsed_terms: ParsedTerms) -> List[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql where
        conditions. filtering out any aggregates"""
        where_conditions: List[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, SearchFilter):
                condition = self.format_search_filter(term)
                if condition:
                    where_conditions.append(condition)

        return where_conditions

    def resolve_having(
        self, parsed_terms: ParsedTerms, use_aggregate_conditions: bool
    ) -> List[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql having
        conditions, filtering only for aggregate conditions"""

        if not use_aggregate_conditions:
            return []

        having_conditions: List[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, AggregateFilter):
                condition = self.convert_aggregate_filter_to_condition(term)
                if condition:
                    having_conditions.append(condition)

        return having_conditions

    def resolve_conditions(
        self,
        query: Optional[str],
        use_aggregate_conditions: bool,
    ) -> Tuple[List[WhereType], List[WhereType]]:
        parsed_terms = self.parse_query(query)

        self.has_or_condition = any(SearchBoolean.is_or_operator(term) for term in parsed_terms)
        if any(
            isinstance(term, ParenExpression) or SearchBoolean.is_operator(term)
            for term in parsed_terms
        ):
            where, having = self.resolve_boolean_conditions(parsed_terms, use_aggregate_conditions)
        else:
            where = self.resolve_where(parsed_terms)
            having = self.resolve_having(parsed_terms, use_aggregate_conditions)
        return where, having

    def resolve_boolean_conditions(
        self, terms: ParsedTerms, use_aggregate_conditions: bool
    ) -> Tuple[List[WhereType], List[WhereType]]:
        if len(terms) == 1:
            return self.resolve_boolean_condition(terms[0], use_aggregate_conditions)

        # Filter out any ANDs since we can assume anything without an OR is an AND. Also do some
        # basic sanitization of the query: can't have two operators next to each other, and can't
        # start or end a query with an operator.
        prev: Union[ParsedTerm, None] = None
        new_terms = []
        term = None
        for term in terms:
            if prev:
                if SearchBoolean.is_operator(prev) and SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Missing condition in between two condition operators: '{prev} {term}'"
                    )
            else:
                if SearchBoolean.is_operator(term):
                    raise InvalidSearchQuery(
                        f"Condition is missing on the left side of '{term}' operator"
                    )

            if term != SearchBoolean.BOOLEAN_AND:
                new_terms.append(term)

            prev = term

        if term is not None and SearchBoolean.is_operator(term):
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
            index = terms.index(SearchBoolean.BOOLEAN_OR)
            lhs, rhs = terms[:index], terms[index + 1 :]
            operator = Or
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = And

        lhs_where, lhs_having = self.resolve_boolean_conditions(lhs, use_aggregate_conditions)
        rhs_where, rhs_having = self.resolve_boolean_conditions(rhs, use_aggregate_conditions)

        if operator == Or and (lhs_where or rhs_where) and (lhs_having or rhs_having):
            raise InvalidSearchQuery(
                "Having an OR between aggregate filters and normal filters is invalid."
            )

        where = self._combine_conditions(lhs_where, rhs_where, operator)
        having = self._combine_conditions(lhs_having, rhs_having, operator)

        return where, having

    def resolve_boolean_condition(
        self, term: ParsedTerm, use_aggregate_conditions: bool
    ) -> Tuple[List[WhereType], List[WhereType]]:
        if isinstance(term, ParenExpression):
            return self.resolve_boolean_conditions(term.children, use_aggregate_conditions)

        where, having = [], []

        if isinstance(term, SearchFilter):
            where = self.resolve_where([term])
        elif isinstance(term, AggregateFilter):
            having = self.resolve_having([term], use_aggregate_conditions)

        return where, having

    def resolve_params(self) -> List[WhereType]:
        """Keys included as url params take precedent if same key is included in search
        They are also considered safe and to have had access rules applied unlike conditions
        from the query string.
        """
        conditions = []

        # start/end are required so that we can run a query in a reasonable amount of time
        if "start" not in self.params or "end" not in self.params:
            raise InvalidSearchQuery("Cannot query without a valid date range")

        start: datetime
        end: datetime
        start, end = self.params["start"], self.params["end"]  # type: ignore
        # Update start to be within retention
        expired, start = outside_retention_with_modified_start(
            start, end, Organization(self.params.get("organization_id"))
        )

        # TODO: this validation should be done when we create the params dataclass instead
        assert isinstance(start, datetime) and isinstance(
            end, datetime
        ), "Both start and end params must be datetime objects"
        project_id: List[int] = self.params.get("project_id", [])  # type: ignore
        assert all(
            isinstance(project_id, int) for project_id in project_id
        ), "All project id params must be ints"
        if expired:
            raise QueryOutsideRetentionError(
                "Invalid date range. Please try a more recent date range."
            )

        conditions.append(Condition(self.column("timestamp"), Op.GTE, start))
        conditions.append(Condition(self.column("timestamp"), Op.LT, end))

        if "project_id" in self.params:
            conditions.append(
                Condition(
                    self.column("project_id"),
                    Op.IN,
                    self.params["project_id"],
                )
            )

        if "environment" in self.params:
            term = SearchFilter(
                SearchKey("environment"), "=", SearchValue(self.params["environment"])
            )
            condition = self._environment_filter_converter(term)
            if condition:
                conditions.append(condition)

        return conditions

    def resolve_select(
        self, selected_columns: Optional[List[str]], equations: Optional[List[str]]
    ) -> List[SelectType]:
        """Given a public list of discover fields, construct the corresponding
        list of Snql Columns or Functions. Duplicate columns are ignored
        """

        if selected_columns is None:
            return []

        resolved_columns = []
        stripped_columns = [column.strip() for column in set(selected_columns)]

        if equations:
            _, _, parsed_equations = resolve_equation_list(
                equations, stripped_columns, use_snql=True, **self.equation_config
            )
            for index, parsed_equation in enumerate(parsed_equations):
                resolved_equation = self.resolve_equation(
                    parsed_equation.equation, f"equation[{index}]"
                )
                resolved_columns.append(resolved_equation)
                if parsed_equation.contains_functions:
                    self.aggregates.append(resolved_equation)

        # Add threshold config alias if there's a function that depends on it
        # TODO: this should be replaced with an explicit request for the project_threshold_config as a column
        for column in self.config.custom_threshold_columns:
            if (
                column in stripped_columns
                and PROJECT_THRESHOLD_CONFIG_ALIAS not in stripped_columns
            ):
                stripped_columns.append(PROJECT_THRESHOLD_CONFIG_ALIAS)
                break

        for column in stripped_columns:
            if column == "":
                continue
            # need to make sure the column is resolved with the appropriate alias
            # because the resolved snuba name may be different
            resolved_column = self.resolve_column(column, alias=True)
            if resolved_column not in self.columns:
                resolved_columns.append(resolved_column)

        # Happens after resolving columns to check if there any aggregates
        if self.auto_fields:
            # Ensure fields we require to build a functioning interface
            # are present.
            if not self.aggregates and "id" not in stripped_columns:
                resolved_columns.append(self.resolve_column("id", alias=True))
                stripped_columns.append("id")
            if "id" in stripped_columns and "project.id" not in stripped_columns:
                resolved_columns.append(self.resolve_column("project.name", alias=True))

        return resolved_columns

    def resolve_field(self, raw_field: str, alias: bool = False) -> Column:
        """Given a public field, resolve the alias based on the Query's
        dataset and return the Snql Column
        """
        tag_match = TAG_KEY_RE.search(raw_field)
        field = tag_match.group("tag") if tag_match else raw_field

        if VALID_FIELD_PATTERN.match(field):
            return self.aliased_column(raw_field) if alias else self.column(raw_field)
        else:
            raise InvalidSearchQuery(f"Invalid characters in field {field}")

    def resolve_field_alias(self, alias: str) -> SelectType:
        """Given a field alias, convert it to its corresponding snql"""
        converter = self.field_alias_converter.get(alias)
        if not converter:
            raise NotImplementedError(f"{alias} not implemented in snql field parsing yet")
        return converter(alias)

    def resolve_function(
        self,
        function: str,
        match: Optional[Match[str]] = None,
        resolve_only: bool = False,
        overwrite_alias: Optional[str] = None,
    ) -> SelectType:
        """Given a public function, resolve to the corresponding Snql function


        :param function: the public alias for a function eg. "p50(transaction.duration)"
        :param match: the Match so we don't have to run the regex twice
        :param resolve_only: whether we should add the aggregate to self.aggregates
        :param overwrite_alias: ignore the alias in the parsed_function and use this string instead
        """
        if match is None:
            match = is_function(function)

        if not match:
            raise InvalidSearchQuery(f"Invalid characters in field {function}")

        name, combinator_name, parsed_arguments, alias = self.parse_function(match)
        if overwrite_alias is not None:
            alias = overwrite_alias

        snql_function = self.function_converter[name]

        combinator = snql_function.find_combinator(combinator_name)

        if combinator_name is not None and combinator is None:
            raise InvalidSearchQuery(
                f"{snql_function.name}: no support for the -{combinator_name} combinator"
            )

        if not snql_function.is_accessible(self.functions_acl, combinator):
            raise InvalidSearchQuery(f"{snql_function.name}: no access to private function")

        combinator_applied = False

        arguments = snql_function.format_as_arguments(
            name, parsed_arguments, self.params, combinator
        )

        self.function_alias_map[alias] = FunctionDetails(function, snql_function, arguments.copy())

        for arg in snql_function.args:
            if isinstance(arg, ColumnArg):
                if (
                    arguments[arg.name] in NumericColumn.numeric_array_columns
                    and isinstance(arg, NumericColumn)
                    and not isinstance(combinator, SnQLArrayCombinator)
                ):
                    arguments[arg.name] = Function(
                        "arrayJoin", [self.resolve_column(arguments[arg.name])]
                    )
                else:
                    arguments[arg.name] = self.resolve_column(arguments[arg.name])
            if combinator is not None and combinator.is_applicable(arg.name):
                arguments[arg.name] = combinator.apply(arguments[arg.name])
                combinator_applied = True

        if combinator and not combinator_applied:
            raise InvalidSearchQuery("Invalid combinator: Arguments passed were incompatible")

        resolved_function = self.resolve_snql_function(
            snql_function, arguments, alias, resolve_only
        )
        if resolved_function is not None:
            return resolved_function

        return snql_function.snql_column(arguments, alias)

    def resolve_snql_function(
        self,
        snql_function: SnQLFunction,
        arguments: Mapping[str, NormalizedArg],
        alias: str,
        resolve_only: bool,
    ) -> Optional[SelectType]:
        if snql_function.snql_aggregate is not None:
            if not resolve_only:
                self.aggregates.append(snql_function.snql_aggregate(arguments, alias))
            return snql_function.snql_aggregate(arguments, alias)
        return None

    def resolve_division(self, dividend: SelectType, divisor: SelectType, alias: str) -> SelectType:
        return Function(
            "if",
            [
                Function(
                    "greater",
                    [divisor, 0],
                ),
                Function(
                    "divide",
                    [
                        dividend,
                        divisor,
                    ],
                ),
                None,
            ],
            alias,
        )

    def resolve_equation(self, equation: Operation, alias: Optional[str] = None) -> SelectType:
        """Convert this tree of Operations to the equivalent snql functions"""
        lhs = self._resolve_equation_operand(equation.lhs)
        rhs = self._resolve_equation_operand(equation.rhs)
        if equation.operator == "divide":
            rhs = Function("nullIf", [rhs, 0])
        return Function(equation.operator, [lhs, rhs], alias)

    def resolve_orderby(self, orderby: Optional[Union[List[str], str]]) -> List[OrderBy]:
        """Given a list of public aliases, optionally prefixed by a `-` to
        represent direction, construct a list of Snql Orderbys
        """
        validated: List[OrderBy] = []

        if orderby is None:
            return validated

        if isinstance(orderby, str):
            if not orderby:
                return validated

            orderby = [orderby]

        orderby_columns: List[str] = orderby if orderby else []

        resolved_orderby: Union[str, SelectType, None]
        for orderby in orderby_columns:
            bare_orderby = orderby.lstrip("-")
            try:
                if is_equation_alias(bare_orderby):
                    resolved_orderby = bare_orderby
                else:
                    resolved_orderby = self.resolve_column(bare_orderby)
            except NotImplementedError:
                resolved_orderby = None

            direction = Direction.DESC if orderby.startswith("-") else Direction.ASC

            if is_function(bare_orderby) and (
                isinstance(resolved_orderby, Function)
                or isinstance(resolved_orderby, CurriedFunction)
            ):
                bare_orderby = resolved_orderby.alias

            for selected_column in self.columns:
                if isinstance(selected_column, Column) and selected_column == resolved_orderby:
                    validated.append(OrderBy(selected_column, direction))
                    break

                elif (
                    isinstance(selected_column, AliasedExpression)
                    and selected_column.alias == bare_orderby
                ):
                    # We cannot directly order by an `AliasedExpression`.
                    # Instead, we order by the column inside.
                    validated.append(OrderBy(selected_column.exp, direction))
                    break

                elif (
                    isinstance(selected_column, CurriedFunction)
                    and selected_column.alias == bare_orderby
                ):
                    validated.append(OrderBy(selected_column, direction))
                    break

        if len(validated) == len(orderby_columns):
            return validated

        # TODO: This is no longer true, can order by fields that aren't selected, keeping
        # for now so we're consistent with the existing functionality
        raise InvalidSearchQuery("Cannot sort by a field that is not selected.")

    def resolve_column(self, field: str, alias: bool = False) -> SelectType:
        """Given a public field, construct the corresponding Snql, this
        function will determine the type of the field alias, whether its a
        column, field alias or function and call the corresponding resolver

        :param field: The public field string to resolve into Snql. This may
                      be a column, field alias, or even a function.
        :param alias: Whether or not the resolved column is aliased to the
                      original name. If false, it may still have an alias
                      but is not guaranteed.
        """
        match = is_function(field)
        if match:
            return self.resolve_function(field, match)
        elif self.is_field_alias(field):
            return self.resolve_field_alias(field)
        else:
            return self.resolve_field(field, alias=alias)

    def resolve_groupby(self) -> List[SelectType]:
        if self.aggregates:
            self.validate_aggregate_arguments()
            return [
                c
                for c in self.columns
                if c not in self.aggregates and not self.is_equation_column(c)
            ]
        else:
            return []

    @property
    def flattened_having(self) -> List[Condition]:
        """Return self.having as a flattened list ignoring boolean operators
        This is because self.having can have a mix of BooleanConditions and Conditions. And each BooleanCondition can in
        turn be a mix of either type.
        """
        flattened: List[Condition] = []
        boolean_conditions: List[BooleanCondition] = []

        for condition in self.having:
            if isinstance(condition, Condition):
                flattened.append(condition)
            elif isinstance(condition, BooleanCondition):
                boolean_conditions.append(condition)

        while len(boolean_conditions) > 0:
            boolean_condition = boolean_conditions.pop()
            for condition in boolean_condition.conditions:
                if isinstance(condition, Condition):
                    flattened.append(condition)
                elif isinstance(condition, BooleanCondition):
                    boolean_conditions.append(condition)

        return flattened

    @cached_property  # type: ignore
    def project_slugs(self) -> Mapping[str, int]:
        project_ids = cast(List[int], self.params.get("project_id", []))

        if len(project_ids) > 0:
            project_slugs = Project.objects.filter(id__in=project_ids)
        else:
            project_slugs = []

        return {p.slug: p.id for p in project_slugs}

    def validate_having_clause(self) -> None:
        """Validate that the functions in having are selected columns

        Skipped if auto_aggregations are enabled, and at least one other aggregate is selected
        This is so we don't change grouping suddenly
        """

        conditions = self.flattened_having
        if self.auto_aggregations and self.aggregates:
            for condition in conditions:
                lhs = condition.lhs
                if isinstance(lhs, CurriedFunction) and lhs not in self.columns:
                    self.columns.append(lhs)
                    self.aggregates.append(lhs)
            return
        # If auto aggregations is disabled or aggregations aren't present in the first place we throw an error
        else:
            error_extra = ", and could not be automatically added" if self.auto_aggregations else ""
            for condition in conditions:
                lhs = condition.lhs
                if isinstance(lhs, CurriedFunction) and lhs not in self.columns:
                    raise InvalidSearchQuery(
                        "Aggregate {} used in a condition but is not a selected column{}.".format(
                            lhs.alias,
                            error_extra,
                        )
                    )

    def validate_aggregate_arguments(self) -> None:
        for column in self.columns:
            if column in self.aggregates:
                continue
            conflicting_functions: List[CurriedFunction] = []
            for aggregate in self.aggregates:
                if column in aggregate.parameters:
                    conflicting_functions.append(aggregate)
            if conflicting_functions:
                # The first two functions and then a trailing count of remaining functions
                function_msg = ", ".join(
                    [self.get_public_alias(function) for function in conflicting_functions[:2]]
                ) + (
                    f" and {len(conflicting_functions) - 2} more."
                    if len(conflicting_functions) > 2
                    else ""
                )
                alias = column.name if type(column) == Column else column.alias
                raise InvalidSearchQuery(
                    f"A single field cannot be used both inside and outside a function in the same query. To use {alias} you must first remove the function(s): {function_msg}"
                )

    # General helper methods
    def aliased_column(self, name: str) -> SelectType:
        """Given an unresolved sentry name and an expected alias, return a snql
        column that will be aliased to the expected alias.

        :param name: The unresolved sentry name.
        :param alias: The expected alias in the result.
        """

        # TODO: This method should use an aliased column from the SDK once
        # that is available to skip these hacks that we currently have to
        # do aliasing.
        resolved = self.resolve_column_name(name)
        column = Column(resolved)

        # If the expected alias is identical to the resolved snuba column,
        # no need to do this aliasing trick.
        #
        # Additionally, tags of the form `tags[...]` can't be aliased again
        # because it confuses the sdk.
        if name == resolved:
            return column

        # If the expected aliases differs from the resolved snuba column,
        # make sure to alias the expression appropriately so we get back
        # the column with the correct names.
        return AliasedExpression(column, name)

    def column(self, name: str) -> Column:
        """Given an unresolved sentry name and return a snql column.

        :param name: The unresolved sentry name.
        """
        resolved_column = self.resolve_column_name(name)
        return Column(resolved_column)

    # Query filter helper methods
    def add_conditions(self, conditions: List[Condition]) -> None:
        self.where += conditions

    def parse_query(self, query: Optional[str]) -> ParsedTerms:
        """Given a user's query, string construct a list of filters that can be
        then used to construct the conditions of the Query"""
        if query is None:
            return []

        try:
            parsed_terms = parse_search_query(query, params=self.params)
        except ParseError as e:
            raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")

        if not parsed_terms:
            return []

        return parsed_terms

    def format_search_filter(self, term: SearchFilter) -> Optional[WhereType]:
        """For now this function seems a bit redundant inside QueryFilter but
        most of the logic from the existing format_search_filter hasn't been
        converted over yet
        """
        name = term.key.name

        converted_filter = self.convert_search_filter_to_condition(
            SearchFilter(
                # We want to use group_id elsewhere so shouldn't be removed from the dataset
                # but if a user has a tag with the same name we want to make sure that works
                SearchKey("tags[group_id]" if name == "group_id" else name),
                term.operator,
                term.value,
            )
        )
        return converted_filter if converted_filter else None

    def _combine_conditions(
        self, lhs: List[WhereType], rhs: List[WhereType], operator: Union[And, Or]
    ) -> List[WhereType]:
        combined_conditions = [
            conditions[0] if len(conditions) == 1 else And(conditions=conditions)
            for conditions in [lhs, rhs]
            if len(conditions) > 0
        ]
        length = len(combined_conditions)
        if length == 0:
            return []
        elif len(combined_conditions) == 1:
            return combined_conditions
        else:
            return [operator(conditions=combined_conditions)]

    def convert_aggregate_filter_to_condition(
        self, aggregate_filter: AggregateFilter
    ) -> Optional[WhereType]:
        name = aggregate_filter.key.name
        value = aggregate_filter.value.value

        value = (
            int(to_timestamp(value))
            if isinstance(value, datetime) and name != "timestamp"
            else value
        )

        if aggregate_filter.operator in {"=", "!="} and value == "":
            operator = Op.IS_NULL if aggregate_filter.operator == "=" else Op.IS_NOT_NULL
            return Condition(name, operator)

        # When resolving functions in conditions we don't want to add them to the list of aggregates
        function = self.resolve_function(name, resolve_only=True)

        return Condition(function, Op(aggregate_filter.operator), value)

    def convert_search_filter_to_condition(
        self,
        search_filter: SearchFilter,
    ) -> Optional[WhereType]:
        name = search_filter.key.name

        if name in NO_CONVERSION_FIELDS:
            return None

        converter = self.search_filter_converter.get(name, self._default_filter_converter)
        return converter(search_filter)

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        lhs = self.resolve_column(name)

        if name in ARRAY_FIELDS:
            if search_filter.value.is_wildcard():
                # TODO: There are rare cases where this chaining don't
                # work. For example, a wildcard like '\**' will incorrectly
                # be replaced with '\%%'.
                return Condition(
                    lhs,
                    Op.LIKE if operator == "=" else Op.NOT_LIKE,
                    # Slashes have to be double escaped so they are
                    # interpreted as a string literal.
                    search_filter.value.raw_value.replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_")
                    .replace("*", "%"),
                )
            elif name in ARRAY_FIELDS and search_filter.is_in_filter:
                return Condition(
                    Function("hasAny", [self.column(name), value]),
                    Op.EQ if operator == "IN" else Op.NEQ,
                    1,
                )
            elif name in ARRAY_FIELDS and search_filter.value.raw_value == "":
                return Condition(
                    Function("notEmpty", [self.column(name)]),
                    Op.EQ if operator == "!=" else Op.NEQ,
                    1,
                )

        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in TIMESTAMP_FIELDS:
            value = int(to_timestamp(value)) * 1000

        if name in {"trace.span", "trace.parent_span"}:
            if search_filter.value.is_wildcard():
                raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(name))
            if not search_filter.value.is_span_id():
                raise InvalidSearchQuery(INVALID_SPAN_ID.format(name))

        # Validate event ids and trace ids are uuids
        if name in {"id", "trace"}:
            if search_filter.value.is_wildcard():
                raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(name))
            elif not search_filter.value.is_event_id():
                label = "Filter ID" if name == "id" else "Filter Trace ID"
                raise InvalidSearchQuery(INVALID_ID_DETAILS.format(label))

        if name in TIMESTAMP_FIELDS:
            if (
                operator in ["<", "<="]
                and value < self.params["start"]
                or operator in [">", ">="]
                and value > self.params["end"]
            ):
                raise InvalidSearchQuery(
                    "Filter on timestamp is outside of the selected date range."
                )

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        if isinstance(lhs, Column) and lhs.subscriptable == "tags":
            if operator not in ["IN", "NOT IN"] and not isinstance(value, str):
                sentry_sdk.set_tag("query.lhs", lhs)
                sentry_sdk.set_tag("query.rhs", value)
                sentry_sdk.capture_message("Tag value was not a string", level="error")
                value = str(value)
            lhs = Function("ifNull", [lhs, ""])

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if search_filter.key.is_tag:
                return Condition(lhs, Op(search_filter.operator), value)
            else:
                # If not a tag, we can just check that the column is null.
                return Condition(Function("isNull", [lhs]), Op(search_filter.operator), 1)

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if (
            search_filter.operator in ("!=", "NOT IN")
            and not search_filter.key.is_tag
            and name != "event.type"
        ):
            # Handle null columns on inequality comparisons. Any comparison
            # between a value and a null will result to null, so we need to
            # explicitly check for whether the condition is null, and OR it
            # together with the inequality check.
            # We don't need to apply this for tags, since if they don't exist
            # they'll always be an empty string.
            is_null_condition = Condition(Function("isNull", [lhs]), Op.EQ, 1)

        if search_filter.value.is_wildcard():
            condition = Condition(
                Function("match", [lhs, f"(?i){value}"]),
                Op(search_filter.operator),
                1,
            )
        else:
            condition = Condition(lhs, Op(search_filter.operator), value)

        if is_null_condition:
            return Or(conditions=[is_null_condition, condition])
        else:
            return condition

    def _environment_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        # conditions added to env_conditions can be OR'ed
        env_conditions = []
        value = search_filter.value.value
        values_set = set(value if isinstance(value, (list, tuple)) else [value])
        # sorted for consistency
        values = sorted(f"{value}" for value in values_set)
        environment = self.column("environment")
        # the "no environment" environment is null in snuba
        if "" in values:
            values.remove("")
            operator = Op.IS_NULL if search_filter.operator == "=" else Op.IS_NOT_NULL
            env_conditions.append(Condition(environment, operator))
        if len(values) == 1:
            operator = Op.EQ if search_filter.operator in EQUALITY_OPERATORS else Op.NEQ
            env_conditions.append(Condition(environment, operator, values.pop()))
        elif values:
            operator = Op.IN if search_filter.operator in EQUALITY_OPERATORS else Op.NOT_IN
            env_conditions.append(Condition(environment, operator, values))
        if len(env_conditions) > 1:
            return Or(conditions=env_conditions)
        else:
            return env_conditions[0]

    # Query Fields helper methods
    def _resolve_equation_operand(self, operand: OperandType) -> Union[SelectType, float]:
        if isinstance(operand, Operation):
            return self.resolve_equation(operand)
        elif isinstance(operand, float):
            return operand
        else:
            return self.resolve_column(operand)

    def is_equation_column(self, column: SelectType) -> bool:
        """Equations are only ever functions, and shouldn't be literals so we
        need to check that the column is a Function
        """
        return isinstance(column, CurriedFunction) and is_equation_alias(column.alias)

    def is_column_function(self, column: SelectType) -> bool:
        return isinstance(column, CurriedFunction) and column not in self.aggregates

        # TODO: This is no longer true, can order by fields that aren't selected, keeping
        # for now so we're consistent with the existing functionality
        raise InvalidSearchQuery("Cannot sort by a field that is not selected.")

    def is_field_alias(self, field: str) -> bool:
        """Given a public field, check if it's a field alias"""
        return field in self.field_alias_converter

    def is_function(self, function: str) -> bool:
        """ "Given a public field, check if it's a supported function"""
        return function in self.function_converter

    def parse_function(self, match: Match[str]) -> Tuple[str, Optional[str], List[str], str]:
        """Given a FUNCTION_PATTERN match, seperate the function name, arguments
        and alias out
        """
        raw_function = match.group("function")
        function, combinator = parse_combinator(raw_function)

        if not self.is_function(function):
            raise InvalidSearchQuery(f"{function} is not a valid function")

        arguments = parse_arguments(function, match.group("columns"))
        alias: Union[str, Any, None] = match.group("alias")

        if alias is None:
            alias = get_function_alias_with_columns(raw_function, arguments)

        return (function, combinator, arguments, alias)

    def get_public_alias(self, function: CurriedFunction) -> str:
        """Given a function resolved by QueryBuilder, get the public alias of that function

        ie. any_user_display -> any(user_display)
        """
        return self.function_alias_map[function.alias].field  # type: ignore

    def get_snql_query(self) -> Query:
        self.validate_having_clause()

        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value, sample=self.sample_rate),
            select=self.columns,
            array_join=self.array_join,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
            turbo=self.turbo,
        )

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        return raw_snql_query(self.get_snql_query(), referrer, use_cache)


class UnresolvedQuery(QueryBuilder):
    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        granularity: Optional[int] = None,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        auto_fields: bool = False,
        auto_aggregations: bool = False,
        functions_acl: Optional[List[str]] = None,
        array_join: Optional[str] = None,
        limit: Optional[int] = 50,
        offset: Optional[int] = 0,
        limitby: Optional[Tuple[str, int]] = None,
        turbo: bool = False,
        sample_rate: Optional[float] = None,
        equation_config: Optional[Dict[str, bool]] = None,
    ):
        super().__init__(
            dataset=dataset,
            params=params,
            granularity=granularity,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            auto_fields=auto_fields,
            auto_aggregations=auto_aggregations,
            functions_acl=functions_acl,
            array_join=array_join,
            limit=limit,
            offset=offset,
            limitby=limitby,
            turbo=turbo,
            sample_rate=sample_rate,
            equation_config=equation_config,
        )

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        granularity: Optional[int] = None,
    ) -> None:
        pass


class TimeseriesQueryBuilder(UnresolvedQuery):
    time_column = Column("time")

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        granularity: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ):
        super().__init__(
            dataset,
            params,
            granularity=granularity,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            auto_fields=False,
            functions_acl=functions_acl,
            equation_config={"auto_add": True, "aggregates_only": True},
        )

        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    def resolve_granularity(self, granularity: Optional[int] = None) -> Optional[Granularity]:
        if granularity is None:
            raise InvalidSearchQuery("Cannot query a timeseries without granularity")
        return Granularity(granularity)

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
        granularity: Optional[int] = None,
    ) -> None:
        self.where, self.having = self.resolve_conditions(query, use_aggregate_conditions=False)

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)
        self.granularity = self.resolve_granularity(granularity)

    @property
    def select(self) -> List[SelectType]:
        if not self.aggregates:
            raise InvalidSearchQuery("Cannot query a timeseries without a Y-Axis")
        # Casting for now since QueryFields/QueryFilter are only partially typed
        return self.aggregates

    def get_snql_query(self) -> Query:
        return Query(
            dataset=self.dataset.value,
            match=Entity(self.dataset.value),
            select=self.select,
            where=self.where,
            having=self.having,
            groupby=self.groupby,
            orderby=[OrderBy(self.time_column, Direction.ASC)],
            granularity=self.granularity,
            limit=self.limit,
        )

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        return raw_snql_query(self.get_snql_query(), referrer, use_cache)


class TopEventsQueryBuilder(TimeseriesQueryBuilder):
    """Create one of two top events queries, which is used for the Top Period &
    Top Daily displays

    This builder requires a Snuba response dictionary that already contains
    the top events for the parameters being queried. eg.
    `[{transaction: foo, count: 100}, {transaction: bar, count:50}]`

    Two types of queries can be constructed through this builder:

    First getting each timeseries for each top event (other=False). Which
    roughly results in a query like the one below. The Groupby allow us to
    get additional rows per time window for each transaction. And the Where
    clause narrows the results to those in the top events:
    ```
        SELECT
            transaction, count(), time
        FROM
            discover
        GROUP BY
            transaction, time
        WHERE
            transaction IN ['foo', 'bar']
    ```

    Secondly This builder can also be used for getting a single timeseries
    for all events not in the top (other=True). Which is done by taking the
    previous query, dropping the groupby, and negating the condition eg.
    ```
        SELECT
            count(), time
        FROM
            discover
        GROUP BY
            time
        WHERE
            transaction NOT IN ['foo', 'bar']
    ```
    """

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        granularity: int,
        top_events: List[Dict[str, Any]],
        other: bool = False,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        timeseries_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        equations = [] if equations is None else equations
        timeseries_equations, timeseries_functions = categorize_columns(timeseries_columns)
        super().__init__(
            dataset,
            params,
            granularity=granularity,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_functions)),
            equations=list(set(equations + timeseries_equations)),
            functions_acl=functions_acl,
            limit=limit,
        )

        self.fields: List[str] = selected_columns if selected_columns is not None else []

        if (conditions := self.resolve_top_event_conditions(top_events, other)) is not None:
            self.where.append(conditions)

        if not other:
            self.groupby.extend(
                [column for column in self.columns if column not in self.aggregates]
            )

    @property
    def translated_groupby(self) -> List[str]:
        """Get the names of the groupby columns to create the series names"""
        translated = []
        for groupby in self.groupby:
            if groupby == self.time_column:
                continue
            if isinstance(groupby, (CurriedFunction, AliasedExpression)):
                translated.append(groupby.alias)
            else:
                translated.append(groupby.name)
        # sorted so the result key is consistent
        return sorted(translated)

    def resolve_top_event_conditions(
        self, top_events: List[Dict[str, Any]], other: bool
    ) -> Optional[WhereType]:
        """Given a list of top events construct the conditions"""
        conditions = []
        for field in self.fields:
            # If we have a project field, we need to limit results by project so we don't hit the result limit
            if field in ["project", "project.id"] and top_events:
                # Iterate through the existing conditions to find the project one
                # the project condition is a requirement of queries so there should always be one
                project_condition = [
                    condition
                    for condition in self.where
                    if type(condition) == Condition and condition.lhs == self.column("project_id")
                ][0]
                self.where.remove(project_condition)
                if field == "project":
                    projects = list({self.project_slugs[event["project"]] for event in top_events})
                else:
                    projects = list({event["project.id"] for event in top_events})
                self.where.append(Condition(self.column("project_id"), Op.IN, projects))
                continue

            resolved_field = self.resolve_column(field)

            values: Set[Any] = set()
            for event in top_events:
                if field in event:
                    alias = field
                elif self.is_column_function(resolved_field) and resolved_field.alias in event:
                    alias = resolved_field.alias
                else:
                    continue

                # Note that because orderby shouldn't be an array field its not included in the values
                if isinstance(event.get(alias), list):
                    continue
                else:
                    values.add(event.get(alias))
            values_list = list(values)

            if values_list:
                if field == "timestamp" or field.startswith("timestamp.to_"):
                    if not other:
                        # timestamp fields needs special handling, creating a big OR instead
                        function, operator = Or, Op.EQ
                    else:
                        # Needs to be a big AND when negated
                        function, operator = And, Op.NEQ
                    if len(values_list) > 1:
                        conditions.append(
                            function(
                                conditions=[
                                    Condition(resolved_field, operator, value)
                                    for value in sorted(values_list)
                                ]
                            )
                        )
                    else:
                        conditions.append(Condition(resolved_field, operator, values_list[0]))
                elif None in values_list:
                    # one of the values was null, but we can't do an in with null values, so split into two conditions
                    non_none_values = [value for value in values_list if value is not None]
                    null_condition = Condition(
                        Function("isNull", [resolved_field]), Op.EQ if not other else Op.NEQ, 1
                    )
                    if non_none_values:
                        non_none_condition = Condition(
                            resolved_field, Op.IN if not other else Op.NOT_IN, non_none_values
                        )
                        if not other:
                            conditions.append(Or(conditions=[null_condition, non_none_condition]))
                        else:
                            conditions.append(And(conditions=[null_condition, non_none_condition]))
                    else:
                        conditions.append(null_condition)
                else:
                    conditions.append(
                        Condition(resolved_field, Op.IN if not other else Op.NOT_IN, values_list)
                    )
        if len(conditions) > 1:
            final_function = And if not other else Or
            final_condition = final_function(conditions=conditions)
        elif len(conditions) == 1:
            final_condition = conditions[0]
        else:
            final_condition = None
        return final_condition


class HistogramQueryBuilder(QueryBuilder):
    base_function_acl = ["array_join", "histogram"]

    def __init__(
        self,
        num_buckets: int,
        histogram_column: str,
        histogram_rows: Optional[int],
        histogram_params: HistogramParams,
        key_column: Optional[str],
        field_names: Optional[List[Union[str, Any, None]]],
        groupby: Optional[List[str]],
        *args: Any,
        **kwargs: Any,
    ):
        kwargs["functions_acl"] = kwargs.get("functions_acl", []) + self.base_function_acl
        super().__init__(*args, **kwargs)
        self.additional_groupby = groupby
        selected_columns = kwargs["selected_columns"]

        resolved_histogram = self.resolve_column(histogram_column)

        # Reset&Ignore the columns from the QueryBuilder
        self.aggregates: List[CurriedFunction] = []
        self.columns = [self.resolve_column("count()"), resolved_histogram]

        if key_column is not None and field_names is not None:
            key_values: List[str] = [field for field in field_names if isinstance(field, str)]
            self.where.append(Condition(self.resolve_column(key_column), Op.IN, key_values))

        # make sure to bound the bins to get the desired range of results
        min_bin = histogram_params.start_offset
        self.where.append(Condition(resolved_histogram, Op.GTE, min_bin))
        max_bin = histogram_params.start_offset + histogram_params.bucket_size * num_buckets
        self.where.append(Condition(resolved_histogram, Op.LTE, max_bin))

        if key_column is not None:
            self.columns.append(self.resolve_column(key_column))

        groups = len(selected_columns) if histogram_rows is None else histogram_rows
        self.limit = Limit(groups * num_buckets)
        self.orderby = (self.orderby if self.orderby else []) + [
            OrderBy(resolved_histogram, Direction.ASC)
        ]

        self.groupby = self.resolve_groupby()
        self.groupby = self.resolve_additional_groupby()

    def resolve_additional_groupby(self) -> List[SelectType]:
        base_groupby = self.groupby
        if base_groupby is not None and self.additional_groupby is not None:
            base_groupby += [self.resolve_column(field) for field in self.additional_groupby]

        return base_groupby


class MetricsQueryBuilder(QueryBuilder):
    def __init__(self, *args: Any, **kwargs: Any):
        self.distributions: List[CurriedFunction] = []
        self.sets: List[CurriedFunction] = []
        self.counters: List[CurriedFunction] = []
        super().__init__(
            # Dataset is always Metrics
            Dataset.Metrics,
            *args,
            **kwargs,
        )

    def resolve_granularity(self, _: Optional[int] = None) -> Optional[Granularity]:
        """Granularity impacts metric queries even when they aren't timeseries because the data needs to be
        pre-aggregated

        Granularity is determined by checking the alignment of our start & end timestamps with the timestamps in
        snuba. eg. we can only use the daily granularity if the query starts and ends at midnight
        Seconds are ignored under the assumption that there currently isn't a valid use case to have
        to-the-second accurate information
        """
        start = cast(datetime, self.params["start"])
        end = cast(datetime, self.params["end"])
        duration = (end - start).seconds

        # TODO: could probably allow some leeway on the start & end (a few minutes) and use a bigger granularity
        # eg. yesterday at 11:59pm to tomorrow at 12:01am could still use the day bucket

        # Query is at least an hour
        if start.minute == end.minute == 0 and duration % 3600 == 0:
            # we're going from midnight -> midnight which aligns with our daily buckets
            if start.hour == end.hour == 0 and duration % 86400 == 0:
                granularity = 86400
            # we're roughly going from start of hour -> next which aligns with our hourly buckets
            else:
                granularity = 3600
        # We're going from one random minute to another, we could use the 10s bucket, but no reason for that precision
        # here
        else:
            granularity = 60
        return Granularity(granularity)

    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()
        conditions.append(
            Condition(self.column("organization_id"), Op.EQ, self.params["organization_id"])
        )
        return conditions

    def resolve_limit(self, limit: Optional[int]) -> Limit:
        """Impose a max limit, since we may need to create a large condition based on the group by values when the query
        is run"""
        if limit is not None and limit > METRICS_MAX_LIMIT:
            raise IncompatibleMetricsQuery(f"Can't have a limit larger than {METRICS_MAX_LIMIT}")
        elif limit is None:
            return Limit(METRICS_MAX_LIMIT)
        else:
            return Limit(limit)

    def resolve_snql_function(
        self,
        snql_function: MetricsFunction,
        arguments: Mapping[str, NormalizedArg],
        alias: str,
        resolve_only: bool,
    ) -> Optional[SelectType]:
        if snql_function.snql_distribution is not None:
            resolved_function = snql_function.snql_distribution(arguments, alias)
            if not resolve_only:
                self.distributions.append(resolved_function)
                # Still add to aggregates so groupby is correct
                self.aggregates.append(resolved_function)
            return resolved_function
        if snql_function.snql_set is not None:
            resolved_function = snql_function.snql_set(arguments, alias)
            if not resolve_only:
                self.sets.append(resolved_function)
                # Still add to aggregates so groupby is correct
                self.aggregates.append(resolved_function)
            return resolved_function
        if snql_function.snql_counter is not None:
            resolved_function = snql_function.snql_counter(arguments, alias)
            if not resolve_only:
                self.counters.append(resolved_function)
                # Still add to aggregates so groupby is correct
                self.aggregates.append(resolved_function)
            return resolved_function
        return None

    @staticmethod
    def _resolve_tag_value(value: str) -> int:
        result = indexer.resolve(value)
        if result is None:
            raise InvalidSearchQuery("Tag value was not found")
        return cast(int, result)

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        if search_filter.value.is_wildcard():
            raise IncompatibleMetricsQuery("wildcards not supported")

        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        lhs = self.resolve_column(name)
        # resolve_column will try to resolve this name with indexer, and if its a tag the Column will be tags[1]
        is_tag = isinstance(lhs, Column) and lhs.subscriptable == "tags"
        if is_tag:
            if isinstance(value, list):
                value = [self._resolve_tag_value(v) for v in value]
            else:
                value = self._resolve_tag_value(value)

        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in TIMESTAMP_FIELDS:
            value = int(to_timestamp(value)) * 1000

        if name in TIMESTAMP_FIELDS:
            if (
                operator in ["<", "<="]
                and value < self.params["start"]
                or operator in [">", ">="]
                and value > self.params["end"]
            ):
                raise InvalidSearchQuery(
                    "Filter on timestamp is outside of the selected date range."
                )

        # TODO(wmak): Need to handle `has` queries, basically check that tags.keys has the value?

        return Condition(lhs, Op(search_filter.operator), value)

    def get_snql_query(self) -> List[Query]:
        """Because metrics table queries need to make multiple requests per metric type this function cannot be
        inmplemented see run_query"""
        raise NotImplementedError("get_snql_query cannot be implemented for MetricsQueryBuilder")

    def _create_query_framework(self) -> Tuple[str, Dict[str, QueryFramework]]:
        query_framework: Dict[str, QueryFramework] = {
            "distribution": QueryFramework(
                orderby=[],
                functions=self.distributions,
                entity=Entity("metrics_distributions", sample=self.sample_rate),
            ),
            "counter": QueryFramework(
                orderby=[],
                functions=self.counters,
                entity=Entity("metrics_counters", sample=self.sample_rate),
            ),
            "set": QueryFramework(
                orderby=[],
                functions=self.sets,
                entity=Entity("metrics_sets", sample=self.sample_rate),
            ),
        }
        primary = None
        # if orderby spans more than one table, the query isn't possible with metrics
        for orderby in self.orderby:
            if orderby.exp in self.distributions:
                query_framework["distribution"].orderby.append(orderby)
                if primary not in [None, "distribution"]:
                    raise IncompatibleMetricsQuery("Can't order across tables")
                primary = "distribution"
            elif orderby.exp in self.sets:
                query_framework["set"].orderby.append(orderby)
                if primary not in [None, "set"]:
                    raise IncompatibleMetricsQuery("Can't order across tables")
                primary = "set"
            elif orderby.exp in self.counters:
                query_framework["counter"].orderby.append(orderby)
                if primary not in [None, "counter"]:
                    raise IncompatibleMetricsQuery("Can't order across tables")
                primary = "counter"
            else:
                # An orderby that isn't on a function add it to all of them
                for framework in query_framework.values():
                    framework.orderby.append(orderby)

        # Pick one arbitrarily, there's no orderby on functions
        if primary is None:
            primary = "distribution"

        return primary, query_framework

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        # Need to split orderby between the 3 possible tables
        # TODO: need to validate orderby, ordering by tag values is impossible unless the values have low cardinality
        # and we can transform them (eg. project)
        primary, query_framework = self._create_query_framework()

        groupby_aliases = [
            groupby.alias
            if isinstance(groupby, (AliasedExpression, CurriedFunction))
            else groupby.name
            for groupby in self.groupby
        ]
        # The typing for these are weak (all using Any) since the results from snuba can contain an assortment of types
        value_map: Dict[str, Any] = defaultdict(dict)
        groupby_values: List[Any] = []
        meta_dict = {}
        result: Any = {
            "data": None,
            "meta": [],
        }
        # We need to run the same logic on all 3 queries, since the `primary` query could come back with no results. The
        # goal is to get n=limit results from one query, then use those n results to create a condition for the
        # remaining queries. This is so that we can respect function orderbys from the first query, but also so we don't
        # get 50 different results from each entity
        for query_details in [query_framework.pop(primary), *query_framework.values()]:
            # Only run the query if there's at least one function, can't query without metrics
            if len(query_details.functions) > 0:
                select = [
                    column
                    for column in self.columns
                    if not isinstance(column, CurriedFunction) or column in query_details.functions
                ]
                if groupby_values:
                    # We already got the groupby values we want, add them to the conditions to limit our results so we
                    # can get the aggregates for the same values
                    where = self.where + [
                        Condition(
                            # Tuples are allowed to have multiple types in clickhouse
                            Function(
                                "tuple",
                                [
                                    groupby.exp
                                    if isinstance(groupby, AliasedExpression)
                                    else groupby
                                    for groupby in self.groupby
                                ],
                            ),
                            Op.IN,
                            Function("tuple", groupby_values),
                        )
                    ]
                    # Because we've added a condition for each groupby value we don't want an offset here
                    offset = Offset(0)
                    referrer_suffix = "secondary"
                else:
                    # We don't have our groupby values yet, this means this is the query where we're getting them
                    where = self.where
                    offset = self.offset
                    referrer_suffix = "primary"

                query = Query(
                    dataset=self.dataset.value,
                    match=query_details.entity,
                    select=select,
                    array_join=self.array_join,
                    where=where,
                    having=self.having,
                    groupby=self.groupby,
                    orderby=query_details.orderby,
                    limit=self.limit,
                    offset=offset,
                    limitby=self.limitby,
                    turbo=self.turbo,
                )
                current_result = raw_snql_query(
                    query,
                    f"{referrer}.{referrer_suffix}",
                    use_cache,
                )
                for row in current_result["data"]:
                    # Arrays in clickhouse cannot contain multiple types, and since groupby values
                    # can contain any type, we must use tuples instead
                    groupby_key = tuple(row[key] for key in groupby_aliases)
                    value_map_key = ",".join(str(value) for value in groupby_key)
                    # First time we're seeing this value, add it to the values we're going to filter by
                    if value_map_key not in value_map:
                        groupby_values.append(groupby_key)
                    value_map[value_map_key].update(row)
                for meta in current_result["meta"]:
                    meta_dict[meta["name"]] = meta["type"]

        result["data"] = list(value_map.values())
        result["meta"] = [{"name": key, "type": value} for key, value in meta_dict.items()]

        return result


class TimeseriesMetricQueryBuilder(MetricsQueryBuilder):
    time_alias = "time"
    time_column = AliasedExpression(Column("timestamp"), time_alias)

    def __init__(
        self,
        params: ParamsType,
        granularity: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
    ):
        super().__init__(
            params=params,
            granularity=granularity,
            query=query,
            selected_columns=selected_columns,
            auto_fields=False,
            functions_acl=functions_acl,
        )

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    def resolve_granularity(self, granularity: Optional[int] = None) -> Optional[Granularity]:
        if granularity is None:
            raise InvalidSearchQuery("Cannot query a timeseries without granularity")
        return Granularity(granularity)

    def get_snql_query(self) -> List[Query]:
        """Because of the way metrics are structured a single request can result in >1 snql query

        This is because different functions will use different entities
        """
        # No need for primary from the query framework since there's no orderby to worry about
        _, query_framework = self._create_query_framework()

        queries: List[Query] = []
        for query_details in query_framework.values():
            if len(query_details.functions) > 0:
                queries.append(
                    Query(
                        dataset=self.dataset.value,
                        match=query_details.entity,
                        select=query_details.functions,
                        where=self.where,
                        having=self.having,
                        groupby=self.groupby,
                        orderby=[OrderBy(self.time_column.exp, Direction.ASC)],
                        granularity=self.granularity,
                        limit=self.limit,
                    )
                )

        return queries

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        queries = self.get_snql_query()
        if queries:
            results = bulk_snql_query(queries, referrer, use_cache)
        else:
            results = []

        time_map: Dict[str, Dict[str, Any]] = defaultdict(dict)
        meta_dict = {}
        for current_result in results:
            # there's only 1 thing in the groupby which is time
            for row in current_result["data"]:
                time_map[row[self.time_alias]].update(row)
            for meta in current_result["meta"]:
                meta_dict[meta["name"]] = meta["type"]

        return {
            "data": list(time_map.values()),
            "meta": [{"name": key, "type": value} for key, value in meta_dict.items()],
        }
