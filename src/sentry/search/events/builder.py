import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Mapping,
    Match,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
    cast,
)

import sentry_sdk
from django.utils import timezone
from django.utils.functional import cached_property
from parsimonious.exceptions import ParseError
from snuba_sdk import Flags, Request
from snuba_sdk.aliased_expression import AliasedExpression
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, BooleanCondition, Condition, Op, Or
from snuba_sdk.entity import Entity
from snuba_sdk.expressions import Granularity, Limit, Offset
from snuba_sdk.function import CurriedFunction, Function
from snuba_sdk.orderby import Direction, LimitBy, OrderBy
from snuba_sdk.query import Query

from sentry import options
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
    is_equation,
    is_equation_alias,
    resolve_equation_list,
    strip_equation,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models import Organization
from sentry.models.project import Project
from sentry.search.events.constants import (
    ARRAY_FIELDS,
    DRY_RUN_COLUMNS,
    DURATION_UNITS,
    EQUALITY_OPERATORS,
    METRICS_GRANULARITIES,
    METRICS_MAX_LIMIT,
    NO_CONVERSION_FIELDS,
    PERCENT_UNITS,
    PROJECT_THRESHOLD_CONFIG_ALIAS,
    QUERY_TIPS,
    SIZE_UNITS,
    TAG_KEY_RE,
    TIMESTAMP_FIELDS,
    TREND_FUNCTION_TYPE_MAP,
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
    get_json_meta_type,
    is_function,
    parse_arguments,
    parse_combinator,
)
from sentry.search.events.filter import ParsedTerm, ParsedTerms
from sentry.search.events.types import (
    EventsResponse,
    HistogramParams,
    ParamsType,
    QueryFramework,
    SelectType,
    WhereType,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.fields import histogram as metrics_histogram
from sentry.snuba.metrics.utils import MetricMeta
from sentry.utils.dates import outside_retention_with_modified_start, to_timestamp
from sentry.utils.snuba import (
    DATASETS,
    Dataset,
    QueryOutsideRetentionError,
    bulk_snql_query,
    is_duration_measurement,
    is_measurement,
    is_numeric_measurement,
    is_percentage_measurement,
    is_span_op_breakdown,
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
        groupby_columns: Optional[List[str]] = None,
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
        # This allows queries to be resolved without adding time constraints. Currently this is just
        # used to allow metric alerts to be built and validated before creation in snuba.
        skip_time_conditions: bool = False,
        parser_config_overrides: Optional[Mapping[str, Any]] = None,
        has_metrics: bool = False,
        transform_alias_to_input_format: bool = False,
        use_metrics_layer: bool = False,
    ):
        self.dataset = dataset

        self.params = params

        org_id = params.get("organization_id")
        self.organization_id: Optional[int] = (
            org_id if org_id is not None and isinstance(org_id, int) else None
        )
        self.has_metrics = has_metrics
        self.transform_alias_to_input_format = transform_alias_to_input_format
        self.raw_equations = equations
        self.use_metrics_layer = use_metrics_layer
        self.auto_fields = auto_fields
        self.functions_acl = set() if functions_acl is None else functions_acl
        self.equation_config = {} if equation_config is None else equation_config
        self.tips: Dict[str, Set[str]] = {
            "query": set(),
            "columns": set(),
        }

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
        self.equation_alias_map: Dict[str, SelectType] = {}
        # field: function map for post-processing values
        self.value_resolver_map: Dict[str, Callable[[Any], Any]] = {}
        # value_resolver_map may change type
        self.meta_resolver_map: Dict[str, str] = {}

        self.auto_aggregations = auto_aggregations
        self.limit = self.resolve_limit(limit)
        self.offset = None if offset is None else Offset(offset)
        self.turbo = turbo
        self.sample_rate = sample_rate
        self.skip_time_conditions = skip_time_conditions
        self.parser_config_overrides = parser_config_overrides

        (
            self.field_alias_converter,
            self.function_converter,
            self.search_filter_converter,
            self.orderby_converter,
        ) = self.load_config()

        self.limitby = self.resolve_limitby(limitby)
        self.array_join = None if array_join is None else [self.resolve_column(array_join)]

        self.start: Optional[datetime] = None
        self.end: Optional[datetime] = None
        self.resolve_query(
            query=query,
            use_aggregate_conditions=use_aggregate_conditions,
            selected_columns=selected_columns,
            groupby_columns=groupby_columns,
            equations=equations,
            orderby=orderby,
        )

    def get_default_converter(self) -> Callable[[SearchFilter], Optional[WhereType]]:
        return self._default_filter_converter

    def resolve_time_conditions(self) -> None:
        if self.skip_time_conditions:
            return
        # start/end are required so that we can run a query in a reasonable amount of time
        if "start" not in self.params or "end" not in self.params:
            raise InvalidSearchQuery("Cannot query without a valid date range")

        # TODO: this validation should be done when we create the params dataclass instead
        assert isinstance(self.params["start"], datetime) and isinstance(
            self.params["end"], datetime
        ), "Both start and end params must be datetime objects"

        # Strip timezone, which are ignored and assumed UTC to match filtering
        self.start = self.params["start"].replace(tzinfo=timezone.utc)
        self.end = self.params["end"].replace(tzinfo=timezone.utc)

    def resolve_column_name(self, col: str) -> str:
        # TODO when utils/snuba.py becomes typed don't need this extra annotation
        column_resolver: Callable[[str], str] = resolve_column(self.dataset)
        return column_resolver(col)

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
    ) -> None:
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_time_conditions"):
            # Has to be done early, since other conditions depend on start and end
            self.resolve_time_conditions()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_conditions"):
            self.where, self.having = self.resolve_conditions(
                query, use_aggregate_conditions=use_aggregate_conditions
            )
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_params"):
            # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
            self.where += self.resolve_params()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_columns"):
            self.columns = self.resolve_select(selected_columns, equations)
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_orderby"):
            self.orderby = self.resolve_orderby(orderby)
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_groupby"):
            self.groupby = self.resolve_groupby(groupby_columns)

    def load_config(
        self,
    ) -> Tuple[
        Mapping[str, Callable[[str], SelectType]],
        Mapping[str, SnQLFunction],
        Mapping[str, Callable[[SearchFilter], Optional[WhereType]]],
        Mapping[str, Callable[[Direction], OrderBy]],
    ]:
        from sentry.search.events.datasets.discover import DiscoverDatasetConfig
        from sentry.search.events.datasets.metrics import MetricsDatasetConfig
        from sentry.search.events.datasets.metrics_layer import MetricsLayerDatasetConfig
        from sentry.search.events.datasets.sessions import SessionsDatasetConfig

        self.config: DatasetConfig
        if self.dataset in [Dataset.Discover, Dataset.Transactions, Dataset.Events]:
            self.config = DiscoverDatasetConfig(self)
        elif self.dataset == Dataset.Sessions:
            self.config = SessionsDatasetConfig(self)
        elif self.dataset in [Dataset.Metrics, Dataset.PerformanceMetrics]:
            if self.use_metrics_layer:
                self.config = MetricsLayerDatasetConfig(self)
            else:
                self.config = MetricsDatasetConfig(self)
        else:
            raise NotImplementedError(f"Data Set configuration not found for {self.dataset}.")

        field_alias_converter = self.config.field_alias_converter
        function_converter = self.config.function_converter
        search_filter_converter = self.config.search_filter_converter
        orderby_converter = self.config.orderby_converter

        return field_alias_converter, function_converter, search_filter_converter, orderby_converter

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
        sentry_sdk.set_tag("query.query_string", query if query else "<No Query>")
        sentry_sdk.set_tag("query.use_aggregate_conditions", use_aggregate_conditions)
        parsed_terms = self.parse_query(query)

        self.has_or_condition = any(SearchBoolean.is_or_operator(term) for term in parsed_terms)
        sentry_sdk.set_tag("query.has_or_condition", self.has_or_condition)

        if any(
            isinstance(term, ParenExpression) or SearchBoolean.is_operator(term)
            for term in parsed_terms
        ):
            where, having = self.resolve_boolean_conditions(parsed_terms, use_aggregate_conditions)
        else:
            where = self.resolve_where(parsed_terms)
            having = self.resolve_having(parsed_terms, use_aggregate_conditions)

        sentry_sdk.set_tag("query.has_having_conditions", len(having) > 0)
        sentry_sdk.set_tag("query.has_where_conditions", len(where) > 0)

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

        is_where_condition: Callable[[List[WhereType]], bool] = lambda x: bool(
            x and len(x) == 1 and isinstance(x[0], Condition)
        )

        if (
            # A direct field:a OR field:b
            operator == Or
            and is_where_condition(lhs_where)
            and is_where_condition(rhs_where)
            and lhs_where[0].lhs == rhs_where[0].lhs
        ) or (
            # Chained or statements become field:a OR (field:b OR (...))
            operator == Or
            and is_where_condition(lhs_where)
            and isinstance(rhs_where[0], Or)
            # Even in a long chain the first condition would be the next field
            and isinstance(rhs_where[0].conditions[0], Condition)
            and lhs_where[0].lhs == rhs_where[0].conditions[0].lhs
        ):
            self.tips["query"].add(QUERY_TIPS["CHAINED_OR"])
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

        # Update start to be within retention
        expired = False
        if self.start and self.end:
            expired, self.start = outside_retention_with_modified_start(
                self.start, self.end, Organization(self.params.get("organization_id"))
            )

        project_id: List[int] = self.params.get("project_id", [])  # type: ignore
        assert all(
            isinstance(project_id, int) for project_id in project_id
        ), "All project id params must be ints"
        if expired:
            raise QueryOutsideRetentionError(
                "Invalid date range. Please try a more recent date range."
            )

        if self.start:
            conditions.append(Condition(self.column("timestamp"), Op.GTE, self.start))
        if self.end:
            conditions.append(Condition(self.column("timestamp"), Op.LT, self.end))

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

        sentry_sdk.set_tag("query.has_equations", equations is not None and len(equations) > 0)
        if equations:
            stripped_columns, parsed_equations = resolve_equation_list(
                equations,
                stripped_columns,
                **self.equation_config,
                custom_measurements=self.get_custom_measurement_names_set(),
            )
            for index, parsed_equation in enumerate(parsed_equations):
                resolved_equation = self.resolve_equation(
                    parsed_equation.equation, f"equation[{index}]"
                )
                self.equation_alias_map[equations[index]] = resolved_equation
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
                    column = self.resolve_column(arguments[arg.name])
                    # Can't keep aliased expressions
                    if isinstance(column, AliasedExpression):
                        column = column.exp
                    arguments[arg.name] = column
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

    def get_function_result_type(
        self,
        function: str,
    ) -> Optional[str]:
        """Given a function, resolve it and then get the result_type

        params to this function should match that of resolve_function
        """
        if function in TREND_FUNCTION_TYPE_MAP:
            # HACK: Don't invalid query here if we don't recognize the function
            # this is cause non-snql tests still need to run and will check here
            # TODO: once non-snql is removed and trends has its own builder this
            # can be removed
            return TREND_FUNCTION_TYPE_MAP.get(function)

        resolved_function = self.resolve_function(function, resolve_only=True)

        if not isinstance(resolved_function, Function) or resolved_function.alias is None:
            return None

        function_details = self.function_alias_map.get(resolved_function.alias)
        if function_details is None:
            return None

        result_type: Optional[str] = function_details.instance.get_result_type(
            function_details.field, function_details.arguments
        )
        return result_type

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

    def resolve_division(
        self, dividend: SelectType, divisor: SelectType, alias: str, fallback: Optional[Any] = None
    ) -> SelectType:
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
                fallback,
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
                # Allow ordering equations with the calculated alias (ie. equation[0])
                if is_equation_alias(bare_orderby):
                    resolved_orderby = bare_orderby
                # Allow ordering equations directly with the raw alias (ie. equation|a + b)
                elif is_equation(bare_orderby):
                    resolved_orderby = self.equation_alias_map[strip_equation(bare_orderby)]
                    bare_orderby = resolved_orderby.alias
                else:
                    resolved_orderby = self.resolve_column(bare_orderby)
            except (NotImplementedError, IncompatibleMetricsQuery):
                resolved_orderby = None

            direction = Direction.DESC if orderby.startswith("-") else Direction.ASC

            if is_function(bare_orderby) and (
                isinstance(resolved_orderby, Function)
                or isinstance(resolved_orderby, CurriedFunction)
                or isinstance(resolved_orderby, AliasedExpression)
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
                    if bare_orderby in self.orderby_converter:
                        validated.append(self.orderby_converter[bare_orderby](direction))
                        break
                    # We cannot directly order by an `AliasedExpression`.
                    # Instead, we order by the column inside.
                    validated.append(OrderBy(selected_column.exp, direction))
                    break

                elif (
                    isinstance(selected_column, CurriedFunction)
                    and selected_column.alias == bare_orderby
                ):
                    if bare_orderby in self.orderby_converter:
                        validated.append(self.orderby_converter[bare_orderby](direction))
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

    def resolve_groupby(self, groupby_columns: Optional[List[str]] = None) -> List[SelectType]:
        if self.aggregates:
            self.validate_aggregate_arguments()
            groupby_columns = (
                [self.resolve_column(column) for column in groupby_columns]
                if groupby_columns
                else []
            )
            return [
                column
                for column in self.columns
                if column not in self.aggregates and not self.is_equation_column(column)
            ] + [
                column
                for column in groupby_columns
                if column not in self.aggregates
                and not self.is_equation_column(column)
                and column not in self.columns
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
    def custom_measurement_map(self) -> List[MetricMeta]:
        # Both projects & org are required, but might be missing for the search parser
        if "project_id" not in self.params or self.organization_id is None or not self.has_metrics:
            return []

        from sentry.snuba.metrics.datasource import get_custom_measurements

        try:
            result: List[MetricMeta] = get_custom_measurements(
                project_ids=self.params["project_id"],
                organization_id=self.organization_id,
                start=datetime.today() - timedelta(days=90),
                end=datetime.today(),
            )
        # Don't fully fail if we can't get the CM, but still capture the exception
        except Exception as error:
            sentry_sdk.capture_exception(error)
            return []
        return result

    def get_custom_measurement_names_set(self) -> Set[str]:
        return {measurement["name"] for measurement in self.custom_measurement_map}

    def get_measument_by_name(self, name: str) -> Optional[MetricMeta]:
        # Skip the iteration if its not a measurement, which can save a custom measurement query entirely
        if not is_measurement(name):
            return None

        for measurement in self.custom_measurement_map:
            if measurement["name"] == name and measurement["metric_id"] is not None:
                return measurement
        return None

    def get_field_type(self, field: str) -> Optional[str]:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if (
            field == "transaction.duration"
            or is_duration_measurement(field)
            or is_span_op_breakdown(field)
        ):
            return "duration"
        elif is_percentage_measurement(field):
            return "percentage"
        elif is_numeric_measurement(field):
            return "number"

        measurement = self.get_measument_by_name(field)
        # let the caller decide what to do
        if measurement is None:
            return None

        unit: str = measurement["unit"]
        if unit in SIZE_UNITS or unit in DURATION_UNITS:
            return unit
        elif unit == "none":
            return "integer"
        elif unit in PERCENT_UNITS:
            return "percentage"
        else:
            return "number"

    @cached_property  # type: ignore
    def project_slugs(self) -> Mapping[str, int]:
        return {project.slug: project.id for project in self.projects}

    @cached_property  # type: ignore
    def projects(self) -> Sequence[Project]:
        project_ids = cast(List[int], self.params.get("project_id", []))

        if len(project_ids) > 0:
            return [project for project in Project.objects.filter(id__in=project_ids)]
        else:
            return []

    @cached_property  # type: ignore
    def project_ids(self) -> Mapping[int, str]:
        return {project_id: slug for slug, project_id in self.project_slugs.items()}

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
            parsed_terms = parse_search_query(
                query,
                params=self.params,
                builder=self,
                config_overrides=self.parser_config_overrides,
            )
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

    def resolve_measurement_value(self, unit: str, value: float) -> float:
        if unit in SIZE_UNITS:
            return SIZE_UNITS[unit] * value
        elif unit in DURATION_UNITS:
            return DURATION_UNITS[unit] * value
        return value

    def convert_aggregate_filter_to_condition(
        self, aggregate_filter: AggregateFilter
    ) -> Optional[WhereType]:
        name = aggregate_filter.key.name
        value = aggregate_filter.value.value
        unit = self.get_function_result_type(aggregate_filter.key.name)
        if unit:
            value = self.resolve_measurement_value(unit, value)

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
        value = search_filter.value.value
        if value and (measurement_meta := self.get_measument_by_name(name)):
            unit = measurement_meta.get("unit")
            value = self.resolve_measurement_value(unit, value)
            search_filter = SearchFilter(
                search_filter.key, search_filter.operator, SearchValue(value)
            )

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
            elif search_filter.is_in_filter:
                return Condition(
                    Function("hasAny", [self.column(name), value]),
                    Op.EQ if operator == "IN" else Op.NEQ,
                    1,
                )
            elif search_filter.value.raw_value == "":
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
                and value < self.start
                or operator in [">", ">="]
                and value > self.end
            ):
                raise InvalidSearchQuery(
                    "Filter on timestamp is outside of the selected date range."
                )

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        is_tag = isinstance(lhs, Column) and lhs.subscriptable == "tags"
        is_context = isinstance(lhs, Column) and lhs.subscriptable == "contexts"
        if is_tag:
            if operator not in ["IN", "NOT IN"] and not isinstance(value, str):
                sentry_sdk.set_tag("query.lhs", lhs)
                sentry_sdk.set_tag("query.rhs", value)
                sentry_sdk.capture_message("Tag value was not a string", level="error")
                value = str(value)
            lhs = Function("ifNull", [lhs, ""])

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if is_tag or is_context:
                return Condition(lhs, Op(search_filter.operator), value)
            else:
                # If not a tag, we can just check that the column is null.
                return Condition(Function("isNull", [lhs]), Op(search_filter.operator), 1)

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if (
            search_filter.operator in ("!=", "NOT IN")
            and not search_filter.key.is_tag
            and name not in self.config.non_nullable_keys
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

    def is_field_alias(self, field: str) -> bool:
        """Given a public field, check if it's a field alias"""
        return field in self.field_alias_converter

    def is_function(self, function: str) -> bool:
        """ "Given a public field, check if it's a supported function"""
        return function in self.function_converter

    def parse_function(self, match: Match[str]) -> Tuple[str, Optional[str], List[str], str]:
        """Given a FUNCTION_PATTERN match, separate the function name, arguments
        and alias out
        """
        raw_function = match.group("function")
        function, combinator = parse_combinator(raw_function)

        if not self.is_function(function):
            raise self.config.missing_function_error(f"{function} is not a valid function")

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

    def get_snql_query(self) -> Request:
        self.validate_having_clause()

        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
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
            ),
            flags=Flags(turbo=self.turbo),
        )

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        return raw_snql_query(self.get_snql_query(), referrer, use_cache)

    def process_results(self, results: Any) -> EventsResponse:
        with sentry_sdk.start_span(op="QueryBuilder", description="process_results") as span:
            span.set_data("result_count", len(results.get("data", [])))
            translated_columns = {}
            if self.transform_alias_to_input_format:
                translated_columns = {
                    column: function_details.field
                    for column, function_details in self.function_alias_map.items()
                }

                self.function_alias_map = {
                    translated_columns.get(column, column): function_details
                    for column, function_details in self.function_alias_map.items()
                }
                if self.raw_equations:
                    for index, equation in enumerate(self.raw_equations):
                        translated_columns[f"equation[{index}]"] = f"equation|{equation}"

            # process the field meta
            field_meta: Dict[str, str] = {}
            if "meta" in results:
                for value in results["meta"]:
                    name = value["name"]
                    key = translated_columns.get(name, name)
                    field_type = get_json_meta_type(key, value.get("type"), self)
                    field_meta[key] = field_type
                # Ensure all columns in the result have types.
                if results["data"]:
                    for key in results["data"][0]:
                        field_key = translated_columns.get(key, key)
                        if field_key not in field_meta:
                            field_meta[field_key] = "string"

            # process the field results
            def get_row(row: Dict[str, Any]) -> Dict[str, Any]:
                transformed = {}
                for key, value in row.items():
                    new_key = translated_columns.get(key, key)

                    if isinstance(value, float):
                        # 0 for nan, and none for inf were chosen arbitrarily, nan and inf are invalid json
                        # so needed to pick something valid to use instead
                        if math.isnan(value):
                            value = 0
                        elif math.isinf(value):
                            value = None
                    if new_key in self.value_resolver_map:
                        new_value = self.value_resolver_map[new_key](value)
                    else:
                        new_value = value

                    transformed[new_key] = new_value

                return transformed

            return {
                "data": [get_row(row) for row in results["data"]],
                "meta": {
                    "fields": field_meta,
                    "tips": {},
                },
            }


class UnresolvedQuery(QueryBuilder):
    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
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
        has_metrics: bool = False,
    ):
        super().__init__(
            dataset=dataset,
            params=params,
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
            has_metrics=has_metrics,
        )

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
    ) -> None:
        pass


class TimeseriesQueryBuilder(UnresolvedQuery):
    time_column = Column("time")

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        interval: int,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
        has_metrics: bool = False,
    ):
        super().__init__(
            dataset,
            params,
            query=query,
            selected_columns=selected_columns,
            equations=equations,
            auto_fields=False,
            functions_acl=functions_acl,
            equation_config={"auto_add": True, "aggregates_only": True},
            has_metrics=has_metrics,
        )

        self.granularity = Granularity(interval)

        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
    ) -> None:
        self.resolve_time_conditions()
        self.where, self.having = self.resolve_conditions(query, use_aggregate_conditions=False)

        # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
        self.where += self.resolve_params()
        self.columns = self.resolve_select(selected_columns, equations)

    @property
    def select(self) -> List[SelectType]:
        if not self.aggregates:
            raise InvalidSearchQuery("Cannot query a timeseries without a Y-Axis")
        # Casting for now since QueryFields/QueryFilter are only partially typed
        return self.aggregates

    def get_snql_query(self) -> Request:
        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=Entity(self.dataset.value),
                select=self.select,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=[OrderBy(self.time_column, Direction.ASC)],
                granularity=self.granularity,
                limit=self.limit,
            ),
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
        interval: int,
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
            interval=interval,
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
    base_function_acl = ["array_join", "histogram", "spans_histogram"]

    def __init__(
        self,
        num_buckets: int,
        histogram_column: str,
        histogram_rows: Optional[int],
        histogram_params: HistogramParams,
        key_column: Optional[str],
        field_names: Optional[List[Union[str, Any, None]]],
        groupby_columns: Optional[List[str]],
        *args: Any,
        **kwargs: Any,
    ):
        kwargs["functions_acl"] = kwargs.get("functions_acl", []) + self.base_function_acl
        super().__init__(*args, **kwargs)
        self.additional_groupby = groupby_columns
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

        self.groupby = self.resolve_groupby(groupby_columns)


class SessionsQueryBuilder(QueryBuilder):
    # ToDo(ahmed): Rename this to AlertsSessionsQueryBuilder as it is exclusively used for crash rate alerts
    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()
        conditions.append(Condition(self.column("org_id"), Op.EQ, self.organization_id))
        return conditions


class SessionsV2QueryBuilder(QueryBuilder):
    filter_allowlist_fields = {"project", "project_id", "environment", "release"}

    def __init__(
        self,
        *args: Any,
        granularity: Optional[int] = None,
        extra_filter_allowlist_fields: Optional[Sequence[str]] = None,
        **kwargs: Any,
    ):
        self._extra_filter_allowlist_fields = extra_filter_allowlist_fields or []
        self.granularity = Granularity(granularity) if granularity is not None else None
        super().__init__(*args, **kwargs)

    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()
        conditions.append(Condition(self.column("org_id"), Op.EQ, self.organization_id))
        return conditions

    def resolve_groupby(self, groupby_columns: Optional[List[str]] = None) -> List[SelectType]:
        """
        The default QueryBuilder `resolve_groupby` function needs to be overridden here because, it only adds the
        columns in the groupBy clause to the query if the query has `aggregates` present in it. For this specific case
        of the `sessions` dataset, the session fields are aggregates but these aggregate definitions are hidden away in
        snuba so if we rely on the default QueryBuilder `resolve_groupby` method, then it won't add the requested
        groupBy columns as it does not consider these fields as aggregates, and so we end up with clickhouse error that
        the column is not under an aggregate function or in the `groupBy` basically.
        """
        if groupby_columns is None:
            return []
        return list({self.resolve_column(column) for column in groupby_columns})

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        if name in self.filter_allowlist_fields or name in self._extra_filter_allowlist_fields:
            return super()._default_filter_converter(search_filter)
        raise InvalidSearchQuery(f"Invalid search filter: {name}")


class TimeseriesSessionsV2QueryBuilder(SessionsV2QueryBuilder):
    time_column = "bucketed_started"

    def get_snql_query(self) -> Request:
        self.validate_having_clause()

        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=Entity(self.dataset.value, sample=self.sample_rate),
                select=[Column(self.time_column)] + self.columns,
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=[Column(self.time_column)] + self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                granularity=self.granularity,
                limitby=self.limitby,
            ),
            flags=Flags(turbo=self.turbo),
        )


class MetricsQueryBuilder(QueryBuilder):
    def __init__(
        self,
        *args: Any,
        # Datasets are currently a bit confusing; Dataset.Metrics is actually release health/sessions
        # Dataset.PerformanceMetrics is MEP. TODO: rename Dataset.Metrics to Dataset.ReleaseMetrics or similar
        dataset: Optional[Dataset] = None,
        allow_metric_aggregates: Optional[bool] = False,
        dry_run: Optional[bool] = False,
        **kwargs: Any,
    ):
        self.distributions: List[CurriedFunction] = []
        self.sets: List[CurriedFunction] = []
        self.counters: List[CurriedFunction] = []
        self.metric_ids: Set[int] = set()
        self.allow_metric_aggregates = allow_metric_aggregates
        self._indexer_cache: Dict[str, Optional[int]] = {}
        self.tag_values_are_strings = options.get(
            "sentry-metrics.performance.tags-values-are-strings"
        )
        # Don't do any of the actions that would impact performance in anyway
        # Skips all indexer checks, and won't interact with clickhouse
        self.dry_run = dry_run
        # always true if this is being called
        kwargs["has_metrics"] = True
        assert dataset is None or dataset in [Dataset.PerformanceMetrics, Dataset.Metrics]
        super().__init__(
            # TODO: defaulting to Metrics for now so I don't have to update incidents tests. Should be
            # PerformanceMetrics
            Dataset.Metrics if dataset is None else dataset,
            *args,
            **kwargs,
        )
        org_id = self.params.get("organization_id")
        if org_id is None or not isinstance(org_id, int):
            raise InvalidSearchQuery("Organization id required to create a metrics query")
        self.organization_id: int = org_id

    def validate_aggregate_arguments(self) -> None:
        if not self.use_metrics_layer:
            super().validate_aggregate_arguments()

    @property
    def is_performance(self) -> bool:
        return self.dataset is Dataset.PerformanceMetrics

    def resolve_query(
        self,
        query: Optional[str] = None,
        use_aggregate_conditions: bool = False,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
    ) -> None:
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_time_conditions"):
            # Has to be done early, since other conditions depend on start and end
            self.resolve_time_conditions()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_conditions"):
            self.where, self.having = self.resolve_conditions(
                query, use_aggregate_conditions=use_aggregate_conditions
            )
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_granularity"):
            # Needs to happen before params and after time conditions since granularity can change start&end
            self.granularity = self.resolve_granularity()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_params"):
            # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
            self.where += self.resolve_params()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_columns"):
            self.columns = self.resolve_select(selected_columns, equations)
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_orderby"):
            self.orderby = self.resolve_orderby(orderby)
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_groupby"):
            self.groupby = self.resolve_groupby(groupby_columns)

        if len(self.metric_ids) > 0 and not self.use_metrics_layer:
            self.where.append(
                # Metric id is intentionally sorted so we create consistent queries here both for testing & caching
                Condition(Column("metric_id"), Op.IN, sorted(self.metric_ids))
            )

    def resolve_column_name(self, col: str) -> str:
        if col.startswith("tags["):
            tag_match = TAG_KEY_RE.search(col)
            col = tag_match.group("tag") if tag_match else col

        if self.use_metrics_layer:
            if col in ["project_id", "timestamp"]:
                return col
            # TODO: update resolve params so this isn't needed
            if col == "organization_id":
                return "org_id"
            return f"tags[{col}]"

        if col in DATASETS[self.dataset]:
            return str(DATASETS[self.dataset][col])
        tag_id = self.resolve_metric_index(col)
        if tag_id is None:
            raise InvalidSearchQuery(f"Unknown field: {col}")
        if self.is_performance and self.tag_values_are_strings:
            return f"tags_raw[{tag_id}]"
        else:
            return f"tags[{tag_id}]"

    def column(self, name: str) -> Column:
        """Given an unresolved sentry name and return a snql column.

        :param name: The unresolved sentry name.
        """
        missing_column = IncompatibleMetricsQuery(f"Column {name} was not found in metrics indexer")
        if self.dry_run:
            if name in DRY_RUN_COLUMNS:
                return Column(name)
            else:
                raise missing_column
        try:
            return super().column(name)
        except InvalidSearchQuery:
            raise missing_column

    def aliased_column(self, name: str) -> SelectType:
        missing_column = IncompatibleMetricsQuery(f"Column {name} was not found in metrics indexer")
        if self.dry_run:
            if name in DRY_RUN_COLUMNS:
                return Column(name)
            else:
                raise missing_column
        try:
            return super().aliased_column(name)
        except InvalidSearchQuery:
            raise missing_column

    def resolve_granularity(self) -> Granularity:
        """Granularity impacts metric queries even when they aren't timeseries because the data needs to be
        pre-aggregated

        Granularity is determined by checking the alignment of our start & end timestamps with the timestamps in
        snuba. eg. we can only use the daily granularity if the query starts and ends at midnight
        Seconds are ignored under the assumption that there currently isn't a valid use case to have
        to-the-second accurate information

        We also allow some flexibility on the granularity used the larger the duration of the query since the hypothesis
        is that users won't be able to notice the loss of accuracy regardless. With that in mind:
        - If duration is between 12 hours to 3d we allow 15 minutes on the hour boundaries for hourly granularity
        - if duration is between 3d to 30d we allow 30 minutes on the day boundaries for daily granularities
            and will fallback to hourly granularity
        - If the duration is over 30d we always use the daily granularities
        """
        if self.end is None or self.start is None:
            raise ValueError("skip_time_conditions must be False when calling this method")
        duration = (self.end - self.start).total_seconds()

        near_midnight: Callable[[datetime], bool] = lambda time: (
            time.minute <= 30 and time.hour == 0
        ) or (time.minute >= 30 and time.hour == 23)
        near_hour: Callable[[datetime], bool] = lambda time: time.minute <= 15 or time.minute >= 45

        if (
            # precisely going hour to hour
            self.start.minute
            == self.end.minute
            == duration % 3600
            == 0
        ):
            # we're going from midnight -> midnight which aligns with our daily buckets
            if self.start.hour == self.end.hour == duration % 86400 == 0:
                granularity = 86400
            # we're roughly going from start of hour -> next which aligns with our hourly buckets
            else:
                granularity = 3600
        elif (
            # Its over 30d, just use the daily granularity
            duration
            >= 86400 * 30
        ):
            self.start = self.start.replace(hour=0, minute=0, second=0, microsecond=0)
            granularity = 86400
        elif (
            # more than 3 days
            duration
            >= 86400 * 3
        ):
            # Allow 30 minutes for the daily buckets
            if near_midnight(self.start) and near_midnight(self.end):
                self.start = self.start.replace(hour=0, minute=0, second=0, microsecond=0)
                granularity = 86400
            else:
                self.start = self.start.replace(minute=0, second=0, microsecond=0)
                granularity = 3600
        elif (
            # more than 12 hours
            (duration >= 3600 * 12)
            # Allow 15 minutes for the hourly buckets
            and near_hour(self.start)
            and near_hour(self.end)
        ):
            self.start = self.start.replace(minute=0, second=0, microsecond=0)
            granularity = 3600
        else:
            granularity = 60
        return Granularity(granularity)

    def resolve_params(self) -> List[WhereType]:
        conditions = super().resolve_params()
        conditions.append(Condition(self.column("organization_id"), Op.EQ, self.organization_id))
        return conditions

    def resolve_having(
        self, parsed_terms: ParsedTerms, use_aggregate_conditions: bool
    ) -> List[WhereType]:
        if not self.allow_metric_aggregates:
            # Regardless of use_aggregate_conditions, check if any having_conditions exist
            having_conditions = super().resolve_having(parsed_terms, True)
            if len(having_conditions) > 0:
                raise IncompatibleMetricsQuery(
                    "Aggregate conditions were disabled, but included in filter"
                )

            # Don't resolve having conditions again if we don't have to
            if use_aggregate_conditions:
                return having_conditions
            else:
                return []
        return super().resolve_having(parsed_terms, use_aggregate_conditions)

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
        if snql_function.snql_metric_layer is not None:
            resolved_function = snql_function.snql_metric_layer(arguments, alias)
            if not resolve_only:
                self.aggregates.append(resolved_function)
            return resolved_function
        return None

    def resolve_metric_index(self, value: str) -> Optional[int]:
        """Layer on top of the metric indexer so we'll only hit it at most once per value"""
        if self.dry_run:
            return -1
        if value not in self._indexer_cache:
            if self.is_performance:
                use_case_id = UseCaseKey.PERFORMANCE
            else:
                use_case_id = UseCaseKey.RELEASE_HEALTH
            result = indexer.resolve(use_case_id, self.organization_id, value)
            self._indexer_cache[value] = result

        return self._indexer_cache[value]

    def resolve_tag_value(self, value: str) -> Optional[Union[int, str]]:
        if self.is_performance and self.tag_values_are_strings:
            return value
        if self.dry_run:
            return -1
        return self.resolve_metric_index(value)

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        if search_filter.value.is_wildcard():
            raise IncompatibleMetricsQuery("wildcards not supported")

        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        lhs = self.resolve_column(name)
        # If this is an aliasedexpression, we don't need the alias here, just the expression
        if isinstance(lhs, AliasedExpression):
            lhs = lhs.exp

        # resolve_column will try to resolve this name with indexer, and if its a tag the Column will be tags[1]
        is_tag = isinstance(lhs, Column) and lhs.subscriptable in ["tags", "tags_raw"]
        if is_tag:
            if isinstance(value, list):
                resolved_value = []
                for item in value:
                    resolved_item = self.resolve_tag_value(item)
                    if resolved_item is None:
                        raise IncompatibleMetricsQuery(f"{name} value {item} in filter not found")
                    resolved_value.append(resolved_item)
                value = resolved_value
            else:
                resolved_item = self.resolve_tag_value(value)
                if resolved_item is None:
                    raise IncompatibleMetricsQuery(f"{name} value {value} in filter not found")
                value = resolved_item

        # timestamp{,.to_{hour,day}} need a datetime string
        # last_seen needs an integer
        if isinstance(value, datetime) and name not in TIMESTAMP_FIELDS:
            value = int(to_timestamp(value)) * 1000

        if name in TIMESTAMP_FIELDS:
            if (
                operator in ["<", "<="]
                and value < self.start
                or operator in [">", ">="]
                and value > self.end
            ):
                raise InvalidSearchQuery(
                    "Filter on timestamp is outside of the selected date range."
                )

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if is_tag:
                return Condition(
                    Function("has", [Column("tags.key"), self.resolve_metric_index(name)]),
                    Op.EQ if search_filter.operator == "!=" else Op.NEQ,
                    1,
                )

        return Condition(lhs, Op(search_filter.operator), value)

    def _resolve_environment_filter_value(self, value: str) -> Union[int, str]:
        value_id: Optional[Union[int, str]] = self.resolve_tag_value(f"{value}")
        if value_id is None:
            raise IncompatibleMetricsQuery(f"Environment: {value} was not found")

        return value_id

    def _environment_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        """All of this is copied from the parent class except for the addition of `resolve_value`

        Going to live with the duplicated code since this will go away anyways once we move to the metric layer
        """
        # conditions added to env_conditions can be OR'ed
        env_conditions = []
        value = search_filter.value.value
        values_set = set(value if isinstance(value, (list, tuple)) else [value])
        # sorted for consistency
        values = []
        for value in values_set:
            if value:
                values.append(self._resolve_environment_filter_value(value))
            elif self.tag_values_are_strings:
                values.append("")
            else:
                values.append(0)
        values.sort()
        environment = self.column("environment")
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

    def get_snql_query(self) -> Request:
        self.validate_having_clause()
        self.validate_orderby_clause()
        # Need to split orderby between the 3 possible tables
        primary, query_framework = self._create_query_framework()
        primary_framework = query_framework.pop(primary)
        if len(primary_framework.functions) == 0:
            raise IncompatibleMetricsQuery("Need at least one function")
        for query_details in query_framework.values():
            if len(query_details.functions) > 0:
                # More than 1 dataset means multiple queries so we can't return them here
                raise NotImplementedError(
                    "get_snql_query cannot be implemented for MetricsQueryBuilder"
                )

        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
                match=primary_framework.entity,
                select=[
                    column
                    for column in self.columns
                    if column in primary_framework.functions or column not in self.aggregates
                ],
                array_join=self.array_join,
                where=self.where,
                having=primary_framework.having,
                groupby=self.groupby,
                orderby=primary_framework.orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=self.limitby,
                granularity=self.granularity,
            ),
            flags=Flags(turbo=self.turbo),
        )

    def _create_query_framework(self) -> Tuple[str, Dict[str, QueryFramework]]:
        prefix = "generic_" if self.dataset is Dataset.PerformanceMetrics else ""
        query_framework: Dict[str, QueryFramework] = {
            "distribution": QueryFramework(
                orderby=[],
                having=[],
                functions=self.distributions,
                entity=Entity(f"{prefix}metrics_distributions", sample=self.sample_rate),
            ),
            "counter": QueryFramework(
                orderby=[],
                having=[],
                functions=self.counters,
                entity=Entity(f"{prefix}metrics_counters", sample=self.sample_rate),
            ),
            "set": QueryFramework(
                orderby=[],
                having=[],
                functions=self.sets,
                entity=Entity(f"{prefix}metrics_sets", sample=self.sample_rate),
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

        having_entity: Optional[str] = None
        for condition in self.flattened_having:
            if condition.lhs in self.distributions:
                if having_entity is None:
                    having_entity = "distribution"
                elif having_entity != "distribution":
                    raise IncompatibleMetricsQuery(
                        "Can only have aggregate conditions on one entity"
                    )
            elif condition.lhs in self.sets:
                if having_entity is None:
                    having_entity = "set"
                elif having_entity != "set":
                    raise IncompatibleMetricsQuery(
                        "Can only have aggregate conditions on one entity"
                    )
            elif condition.lhs in self.counters:
                if having_entity is None:
                    having_entity = "counter"
                elif having_entity != "counter":
                    raise IncompatibleMetricsQuery(
                        "Can only have aggregate conditions on one entity"
                    )

        if primary is not None and having_entity is not None and having_entity != primary:
            raise IncompatibleMetricsQuery(
                "Can't use a having condition on non primary distribution"
            )

        # Pick one arbitrarily, there's no orderby on functions
        if primary is None:
            if having_entity is not None:
                primary = having_entity
            elif len(self.distributions) > 0:
                primary = "distribution"
            elif len(self.counters) > 0:
                primary = "counter"
            elif len(self.sets) > 0:
                primary = "set"
            else:
                raise IncompatibleMetricsQuery("Need at least one function")

        query_framework[primary].having = self.having

        return primary, query_framework

    def validate_orderby_clause(self) -> None:
        """Check that the orderby doesn't include any direct tags, this shouldn't raise an error for project since we
        transform it"""
        for orderby in self.orderby:
            if (
                isinstance(orderby.exp, Column)
                and orderby.exp.subscriptable in ["tags", "tags_raw"]
            ) or (
                isinstance(orderby.exp, Function) and orderby.exp.alias in ["transaction", "title"]
            ):
                raise IncompatibleMetricsQuery("Can't orderby tags")

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        self.validate_having_clause()
        self.validate_orderby_clause()
        if self.use_metrics_layer:
            from sentry.snuba.metrics.datasource import get_series
            from sentry.snuba.metrics.mqb_query_transformer import (
                tranform_mqb_query_to_metrics_query,
            )

            if self.is_performance:
                use_case_id = UseCaseKey.PERFORMANCE
            else:
                use_case_id = UseCaseKey.RELEASE_HEALTH
            prefix = "generic_" if self.dataset is Dataset.PerformanceMetrics else ""

            snuba_query = Query(
                match=Entity(f"{prefix}metrics_distributions", sample=self.sample_rate),
                # Metrics doesn't support columns in the select, and instead expects them in the groupby
                select=self.aggregates
                + [
                    # Team key transaction is a special case sigh
                    col
                    for col in self.columns
                    if isinstance(col, Function) and col.function == "team_key_transaction"
                ],
                array_join=self.array_join,
                where=self.where,
                having=self.having,
                groupby=self.groupby,
                orderby=self.orderby,
                limit=self.limit,
                offset=self.offset,
                limitby=self.limitby,
            )
            try:
                metric_query = tranform_mqb_query_to_metrics_query(snuba_query)
                metrics_data = get_series(
                    projects=self.projects,
                    metrics_query=metric_query,
                    use_case_id=use_case_id,
                    include_meta=True,
                )
            except Exception as err:
                raise IncompatibleMetricsQuery(err)
            # series does some strange stuff to the clickhouse response, turn it back so we can handle it
            metric_layer_result: Any = {
                "data": [],
                "meta": metrics_data["meta"],
            }
            for group in metrics_data["groups"]:
                data = group["by"]
                data.update(group["totals"])
                metric_layer_result["data"].append(data)
                for meta in metric_layer_result["meta"]:
                    if data[meta["name"]] is None:
                        data[meta["name"]] = self.get_default_value(meta["type"])
            return metric_layer_result
        # Need to split orderby between the 3 possible tables
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
        if self.dry_run:
            return result
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
                    if column in query_details.functions or column not in self.aggregates
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
                    match=query_details.entity,
                    select=select,
                    array_join=self.array_join,
                    where=where,
                    having=query_details.having,
                    groupby=self.groupby,
                    orderby=query_details.orderby,
                    limit=self.limit,
                    offset=offset,
                    limitby=self.limitby,
                    granularity=self.granularity,
                )
                request = Request(
                    dataset=self.dataset.value,
                    app_id="default",
                    query=query,
                    flags=Flags(turbo=self.turbo),
                )
                current_result = raw_snql_query(
                    request,
                    f"{referrer}.{referrer_suffix}",
                    use_cache,
                )
                for row in current_result["data"]:
                    # Arrays in clickhouse cannot contain multiple types, and since groupby values
                    # can contain any type, we must use tuples instead
                    groupby_key = tuple(row[key] for key in groupby_aliases)
                    value_map_key = ",".join(str(value) for value in groupby_key)
                    # First time we're seeing this value, add it to the values we're going to filter by
                    if value_map_key not in value_map and groupby_key:
                        groupby_values.append(groupby_key)
                    value_map[value_map_key].update(row)
                for meta in current_result["meta"]:
                    meta_dict[meta["name"]] = meta["type"]

        result["data"] = list(value_map.values())
        result["meta"] = [{"name": key, "type": value} for key, value in meta_dict.items()]

        # Data might be missing for fields after merging the requests, eg a transaction with no users
        for row in result["data"]:
            for meta in result["meta"]:
                if meta["name"] not in row:
                    row[meta["name"]] = self.get_default_value(meta["type"])

        return result

    def process_results(self, results: Any) -> EventsResponse:
        """Go through the results of a metrics query and reverse resolve its tags"""
        processed_results: EventsResponse = super().process_results(results)
        tags: List[str] = []
        cached_resolves: Dict[int, Optional[str]] = {}
        # no-op if they're already strings
        if self.tag_values_are_strings:
            return processed_results

        with sentry_sdk.start_span(op="mep", description="resolve_tags"):
            for column in self.columns:
                if (
                    isinstance(column, AliasedExpression)
                    and column.exp.subscriptable == "tags"
                    and column.alias
                ):
                    tags.append(column.alias)
                # transaction is a special case since we use a transform null & unparam
                if column.alias in ["transaction", "title"]:
                    tags.append(column.alias)

            for tag in tags:
                for row in processed_results["data"]:
                    if isinstance(row[tag], int):
                        if row[tag] not in cached_resolves:
                            resolved_tag = indexer.reverse_resolve(
                                UseCaseKey.PERFORMANCE, self.organization_id, row[tag]
                            )
                            cached_resolves[row[tag]] = resolved_tag
                        row[tag] = cached_resolves[row[tag]]
                if tag in processed_results["meta"]["fields"]:
                    processed_results["meta"]["fields"][tag] = "string"

        return processed_results

    @staticmethod
    def get_default_value(meta_type: str) -> Any:
        """Given a meta type return the expected default type

        for example with a UInt64 (like a count_unique) return 0
        """
        if (
            meta_type.startswith("Int")
            or meta_type.startswith("UInt")
            or meta_type.startswith("Float")
        ):
            return 0
        else:
            return None


class AlertMetricsQueryBuilder(MetricsQueryBuilder):
    def __init__(
        self,
        *args: Any,
        granularity: int,
        **kwargs: Any,
    ):
        self._granularity = granularity
        super().__init__(*args, **kwargs)

    def resolve_limit(self, limit: Optional[int]) -> Optional[Limit]:
        return None

    def resolve_granularity(self) -> Granularity:
        return Granularity(self._granularity)


class HistogramMetricQueryBuilder(MetricsQueryBuilder):
    base_function_acl = ["histogram"]

    def __init__(
        self,
        histogram_params: HistogramParams,
        *args: Any,
        **kwargs: Any,
    ):
        self.params = kwargs["params"]
        self.histogram_aliases: List[str] = []
        self.num_buckets = histogram_params.num_buckets
        self.min_bin = histogram_params.start_offset
        self.max_bin = (
            histogram_params.start_offset + histogram_params.bucket_size * self.num_buckets
        )
        if "organization_id" in self.params:
            self.organization_id: int = cast(int, self.params["organization_id"])
        else:
            raise InvalidSearchQuery("Organization id required to create a metrics query")

        self.zoom_params: Optional[Function] = metrics_histogram.zoom_histogram(
            self.num_buckets,
            self.min_bin,
            self.max_bin,
        )

        kwargs["functions_acl"] = kwargs.get("functions_acl", []) + self.base_function_acl
        super().__init__(*args, **kwargs)

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        result = super().run_query(referrer, use_cache)
        for row in result["data"]:
            for key, value in row.items():
                if key in self.histogram_aliases:
                    row[key] = metrics_histogram.rebucket_histogram(
                        value, self.num_buckets, self.min_bin, self.max_bin
                    )

        return result


class TimeseriesMetricQueryBuilder(MetricsQueryBuilder):
    time_alias = "time"

    def __init__(
        self,
        params: ParamsType,
        interval: int,
        dataset: Optional[Dataset] = None,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        allow_metric_aggregates: Optional[bool] = False,
        functions_acl: Optional[List[str]] = None,
        dry_run: Optional[bool] = False,
        limit: Optional[int] = 10000,
    ):
        super().__init__(
            params=params,
            query=query,
            dataset=dataset,
            selected_columns=selected_columns,
            allow_metric_aggregates=allow_metric_aggregates,
            auto_fields=False,
            functions_acl=functions_acl,
            dry_run=dry_run,
        )
        if self.granularity.granularity > interval:
            for granularity in METRICS_GRANULARITIES:
                if granularity < interval:
                    self.granularity = Granularity(granularity)
                    break

        self.time_column = self.resolve_time_column(interval)
        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the groupby will always be time
        self.groupby = [self.time_column]

    def resolve_time_column(self, interval: int) -> Function:
        """Need to round the timestamp to the interval requested

        We commonly use interval & granularity interchangeably, but in the case of the metrics dataset they must be
        considered as two separate things. The reason being the way we store metrics will rarely align with the
        start&end of the query.
        This means that we'll need to select granularity for data accuracy, and then use the clickhouse
        toStartOfInterval function to group results by their displayed interval

        eg.
        See test_builder.test_run_query_with_hour_interval for this in test form
        we have a query from yesterday at 15:30 -> today at 15:30
        there is 1 event at 15:45
        and we want the timeseries displayed at 1 hour intervals

        The event is in the quantized hour-aligned metrics bucket of 15:00, since the bounds of the query are
        (Yesterday 15:30, Today 15:30) the condition > Yesterday 15:30 means using the hour-aligned bucket you'd
        miss that event.

        So instead in this case we want the minute-aligned bucket, while rounding timestamp to the hour, so we'll
        only get data that is relevant because of the timestamp filters. And Snuba will merge the datasketches for
        us to get correct data.
        """
        if interval < 10:
            raise IncompatibleMetricsQuery(
                "Interval must be at least 10s because our smallest granularity is 10s"
            )

        return Function(
            "toStartOfInterval",
            [
                Column("timestamp"),
                Function("toIntervalSecond", [interval]),
                "Universal",
            ],
            self.time_alias,
        )

    def get_snql_query(self) -> List[Request]:
        """Because of the way metrics are structured a single request can result in >1 snql query

        This is because different functions will use different entities
        """
        # No need for primary from the query framework since there's no orderby to worry about
        _, query_framework = self._create_query_framework()

        queries: List[Request] = []
        for query_details in query_framework.values():
            if len(query_details.functions) > 0:
                queries.append(
                    Request(
                        dataset=self.dataset.value,
                        app_id="default",
                        query=Query(
                            match=query_details.entity,
                            select=query_details.functions,
                            where=self.where,
                            having=self.having,
                            groupby=self.groupby,
                            orderby=[OrderBy(self.time_column, Direction.ASC)],
                            granularity=self.granularity,
                            limit=self.limit,
                        ),
                    )
                )

        return queries

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        queries = self.get_snql_query()
        if self.dry_run:
            return {
                "data": [],
                "meta": [],
            }
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
