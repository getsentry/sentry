from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from datetime import datetime, timedelta
from re import Match
from typing import Any, Union, cast

import sentry_sdk
from django.utils.functional import cached_property
from parsimonious.exceptions import ParseError
from snuba_sdk import (
    AliasedExpression,
    And,
    BooleanCondition,
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Flags,
    Function,
    Limit,
    LimitBy,
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry.api import event_search
from sentry.discover.arithmetic import (
    OperandType,
    Operation,
    is_equation,
    is_equation_alias,
    resolve_equation_list,
    strip_equation,
)
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.search.events import constants, fields
from sentry.search.events import filter as event_filter
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.types import (
    EventsResponse,
    NormalizedArg,
    ParamsType,
    QueryBuilderConfig,
    SelectType,
    SnubaParams,
    WhereType,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.metrics.utils import MetricMeta
from sentry.snuba.query_sources import QuerySource
from sentry.users.services.user.service import user_service
from sentry.utils.dates import outside_retention_with_modified_start
from sentry.utils.env import in_test_environment
from sentry.utils.snuba import (
    QueryOutsideRetentionError,
    UnqualifiedQueryError,
    is_duration_measurement,
    is_measurement,
    is_numeric_measurement,
    is_percentage_measurement,
    is_span_op_breakdown,
    process_value,
    raw_snql_query,
    resolve_column,
)
from sentry.utils.validators import INVALID_ID_DETAILS, INVALID_SPAN_ID, WILDCARD_NOT_ALLOWED

DATASET_TO_ENTITY_MAP: Mapping[Dataset, EntityKey] = {
    Dataset.Events: EntityKey.Events,
    Dataset.Transactions: EntityKey.Transactions,
    Dataset.EventsAnalyticsPlatform: EntityKey.EAPSpans,
}


class BaseQueryBuilder:
    requires_organization_condition: bool = False
    organization_column: str = "organization.id"
    function_alias_prefix: str | None = None
    spans_metrics_builder = False
    entity: Entity | None = None
    config_class: type[DatasetConfig] | None = None
    duration_fields: set[str] = set()
    size_fields: dict[str, str] = {}
    uuid_fields: set[str] = set()
    span_id_fields: set[str] = set()

    def get_middle(self):
        """Get the middle for comparison functions"""
        if self.start is None or self.end is None:
            raise InvalidSearchQuery("Need both start & end to use percent_change")
        return self.start + (self.end - self.start) / 2

    def first_half_condition(self):
        """Create the first half condition for percent_change functions"""
        return Function(
            "less",
            [
                self.column("timestamp"),
                Function("toDateTime", [self.get_middle()]),
            ],
        )

    def second_half_condition(self):
        """Create the second half condition for percent_change functions"""
        return Function(
            "greaterOrEquals",
            [
                self.column("timestamp"),
                Function("toDateTime", [self.get_middle()]),
            ],
        )

    def _dataclass_params(
        self, snuba_params: SnubaParams | None, params: ParamsType
    ) -> SnubaParams:
        """Shim so the query builder can start using the dataclass

        need a lot of type: ignore since the params being passed can't be trusted from files that are probably still in the type ignorelist
        """
        if snuba_params is not None:
            return snuba_params

        if "project_objects" in params:
            projects = params["project_objects"]
        elif "project_id" in params and (
            isinstance(params["project_id"], list) or isinstance(params["project_id"], tuple)  # type: ignore[unreachable]
        ):
            projects = list(Project.objects.filter(id__in=params["project_id"]))
        else:
            projects = []

        if "organization_id" in params and isinstance(params["organization_id"], int):
            organization = Organization.objects.filter(id=params["organization_id"]).first()
        else:
            organization = projects[0].organization if projects else None

        # Yes this is a little janky, but its temporary until we can have everyone passing the dataclass directly
        environments: Sequence[Environment | None] = []
        if "environment_objects" in params:
            environments = cast(Sequence[Union[Environment, None]], params["environment_objects"])
        if "environment" in params and organization is not None:
            if isinstance(params["environment"], list):
                environments = list(
                    Environment.objects.filter(
                        organization_id=organization.id, name__in=params["environment"]
                    )
                )
                if "" in params["environment"]:
                    environments.append(None)
            elif isinstance(params["environment"], str):
                environments = list(
                    Environment.objects.filter(
                        organization_id=organization.id, name=params["environment"]
                    )
                )
            else:
                environments = []  # type: ignore[unreachable]

        user_id = params.get("user_id")
        user = user_service.get_user(user_id=user_id) if user_id is not None else None  # type: ignore[arg-type]
        teams = (
            Team.objects.filter(id__in=params["team_id"])
            if "team_id" in params and isinstance(params["team_id"], list)
            else []
        )
        return SnubaParams(
            start=cast(datetime, params.get("start")),
            end=cast(datetime, params.get("end")),
            environments=environments,
            projects=projects,
            user=user,
            teams=teams,
            organization=organization,
        )

    def __init__(
        self,
        dataset: Dataset,
        params: ParamsType,
        config: QueryBuilderConfig | None = None,
        snuba_params: SnubaParams | None = None,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
        limit: int | None = 50,
        offset: int | None = 0,
        limitby: tuple[str, int] | None = None,
        turbo: bool = False,
        sample_rate: float | None = None,
        array_join: str | None = None,
        entity: Entity | None = None,
    ):
        if config is None:
            self.builder_config = QueryBuilderConfig()
        else:
            self.builder_config = config
        if self.builder_config.parser_config_overrides is None:
            self.builder_config.parser_config_overrides = {}

        self.dataset = dataset

        # filter params is the older style params, shouldn't be used anymore
        self.filter_params = params
        if snuba_params is not None:
            self.filter_params = snuba_params.filter_params
        self.params = self._dataclass_params(snuba_params, params)

        org_id = self.params.organization_id
        self.organization_id: int | None = (
            org_id if org_id is not None and isinstance(org_id, int) else None
        )
        self.raw_equations = equations
        self.raw_orderby = orderby
        self.query = query
        self.selected_columns = selected_columns
        self.groupby_columns = groupby_columns
        self.tips: dict[str, set[str]] = {
            "query": set(),
            "columns": set(),
        }

        # Base Tenant IDs for any Snuba Request built/executed using a QueryBuilder
        org_id = self.organization_id or (
            self.params.organization.id if self.params.organization else None
        )
        self.tenant_ids: dict[str, str | None | int] | None = dict()
        if org_id is not None:
            self.tenant_ids["organization_id"] = org_id
        if "use_case_id" in params and params.get("use_case_id") is not None:
            self.tenant_ids["use_case_id"] = params.get("use_case_id")
        if not self.tenant_ids:
            self.tenant_ids = None

        # Function is a subclass of CurriedFunction
        self.where: list[WhereType] = []
        self.having: list[WhereType] = []
        # The list of aggregates to be selected
        self.aggregates: list[CurriedFunction] = []
        self.columns: list[SelectType] = []
        self.orderby: list[OrderBy] = []
        self.groupby: list[SelectType] = []

        self.projects_to_filter: set[int] = set()
        self.function_alias_map: dict[str, fields.FunctionDetails] = {}
        self.equation_alias_map: dict[str, SelectType] = {}
        # field: function map for post-processing values
        self.value_resolver_map: dict[str, Callable[[Any], Any]] = {}
        # value_resolver_map may change type
        self.meta_resolver_map: dict[str, str] = {}

        # These maps let us convert from prefixed to original tag keys
        # and vice versa to avoid collisions where tags and functions have
        # similar aliases
        self.prefixed_to_tag_map: dict[str, str] = {}
        self.tag_to_prefixed_map: dict[str, str] = {}

        # Tags with their type in them can't be passed to clickhouse because of the space
        # This map is so we can convert those back before the user sees the internal alias
        self.typed_tag_to_alias_map: dict[str, str] = {}
        self.alias_to_typed_tag_map: dict[str, str] = {}

        self.requires_other_aggregates = False
        self.limit = self.resolve_limit(limit)
        self.offset = None if offset is None else Offset(offset)
        self.turbo = turbo
        self.sample_rate = sample_rate

        self.config = self.load_config()
        self.parse_config()

        self.start: datetime | None = None
        self.end: datetime | None = None
        self.resolve_query(
            query=query,
            selected_columns=selected_columns,
            groupby_columns=groupby_columns,
            equations=equations,
            orderby=orderby,
        )
        self.entity = entity

        self.limitby = self.resolve_limitby(limitby)
        self.array_join = None if array_join is None else [self.resolve_column(array_join)]

    def are_columns_resolved(self) -> bool:
        return len(self.columns) > 0 and isinstance(self.columns[0], Function)

    def resolve_time_conditions(self) -> None:
        if self.builder_config.skip_time_conditions:
            return

        # start/end are required so that we can run a query in a reasonable amount of time
        if self.params.start is None or self.params.end is None:
            raise InvalidSearchQuery("Cannot query without a valid date range")

        self.start = self.params.start
        self.end = self.params.end

    def resolve_column_name(self, col: str) -> str:
        # TODO: when utils/snuba.py becomes typed don't need this extra annotation
        column_resolver: Callable[[str], str] = resolve_column(self.dataset)
        column_name = column_resolver(col)
        # If the original column was passed in as tag[X], then there won't be a conflict
        # and there's no need to prefix the tag
        if not col.startswith("tags[") and column_name.startswith("tags["):
            self.prefixed_to_tag_map[f"tags_{col}"] = col
            self.tag_to_prefixed_map[col] = f"tags_{col}"
        return column_name

    def resolve_query(
        self,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        with sentry_sdk.start_span(op="QueryBuilder", name="resolve_query"):
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_time_conditions"):
                # Has to be done early, since other conditions depend on start and end
                self.resolve_time_conditions()
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_conditions"):
                self.where, self.having = self.resolve_conditions(query)
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_params"):
                # params depends on parse_query, and conditions being resolved first since there may be projects in conditions
                self.where += self.resolve_params()
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_columns"):
                self.columns = self.resolve_select(selected_columns, equations)
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_orderby"):
                self.orderby = self.resolve_orderby(orderby)
            with sentry_sdk.start_span(op="QueryBuilder", name="resolve_groupby"):
                self.groupby = self.resolve_groupby(groupby_columns)

    def parse_config(self) -> None:
        if not hasattr(self, "config") or self.config is None:
            raise Exception("Setup failed, dataset config was not loaded")
        self.field_alias_converter = self.config.field_alias_converter
        self.function_converter = self.config.function_converter
        self.search_filter_converter = self.config.search_filter_converter
        self.orderby_converter = self.config.orderby_converter

    def load_config(self) -> DatasetConfig:
        if self.config_class is None:
            raise NotImplementedError("config_class was not set on this QueryBuilder")
        return self.config_class(self)

    def resolve_limit(self, limit: int | None) -> Limit | None:
        return None if limit is None else Limit(limit)

    def resolve_limitby(self, limitby: tuple[str, int] | None) -> LimitBy | None:
        if limitby is None:
            return None

        column, count = limitby
        resolved = self.resolve_column(column)

        if isinstance(resolved, Column):
            return LimitBy([resolved], count)

        # Special case to allow limit bys on array joined columns.
        # Simply allowing any function to be used in a limit by
        # result in hard to debug issues so be careful.
        if isinstance(resolved, Function) and resolved.function == "arrayJoin":
            return LimitBy([Column(resolved.alias)], count)

        # TODO: Limit By can only operate on a `Column`. This has the implication
        # that non aggregate transforms are not allowed in the order by clause.
        raise InvalidSearchQuery(f"{column} used in a limit by but is not a column.")

    def resolve_where(self, parsed_terms: event_filter.ParsedTerms) -> list[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql where
        conditions. filtering out any aggregates"""
        where_conditions: list[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, event_search.SearchFilter):
                # I have no idea why but mypy thinks this is SearchFilter | SearchFilter, which is incompatible with SearchFilter...
                condition = self.format_search_filter(cast(event_search.SearchFilter, term))
                if condition:
                    where_conditions.append(condition)

        return where_conditions

    def resolve_having(self, parsed_terms: event_filter.ParsedTerms) -> list[WhereType]:
        """Given a list of parsed terms, construct their equivalent snql having
        conditions, filtering only for aggregate conditions"""

        if not self.builder_config.use_aggregate_conditions:
            return []

        having_conditions: list[WhereType] = []
        for term in parsed_terms:
            if isinstance(term, event_search.AggregateFilter):
                # I have no idea why but mypy thinks this is AggregateFilter | AggregateFilter, which is incompatible with AggregateFilter...
                condition = self.convert_aggregate_filter_to_condition(
                    cast(event_search.AggregateFilter, term)
                )
                if condition:
                    having_conditions.append(condition)

        return having_conditions

    def resolve_conditions(
        self,
        query: str | None,
    ) -> tuple[list[WhereType], list[WhereType]]:
        sentry_sdk.set_tag("query.query_string", query if query else "<No Query>")
        sentry_sdk.set_tag(
            "query.use_aggregate_conditions", self.builder_config.use_aggregate_conditions
        )
        parsed_terms = self.parse_query(query)

        self.has_or_condition = any(
            event_search.SearchBoolean.is_or_operator(term) for term in parsed_terms
        )
        sentry_sdk.set_tag("query.has_or_condition", self.has_or_condition)

        if any(
            isinstance(term, event_search.ParenExpression)
            or event_search.SearchBoolean.is_operator(term)
            for term in parsed_terms
        ):
            where, having = self.resolve_boolean_conditions(parsed_terms)
        else:
            where = self.resolve_where(parsed_terms)
            having = self.resolve_having(parsed_terms)

        sentry_sdk.set_tag("query.has_having_conditions", len(having) > 0)
        sentry_sdk.set_tag("query.has_where_conditions", len(where) > 0)

        return where, having

    def resolve_boolean_conditions(
        self, terms: event_filter.ParsedTerms
    ) -> tuple[list[WhereType], list[WhereType]]:
        if len(terms) == 1:
            return self.resolve_boolean_condition(terms[0])

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
            operator = Or
        except Exception:
            lhs, rhs = terms[:1], terms[1:]
            operator = And

        lhs_where, lhs_having = self.resolve_boolean_conditions(lhs)
        rhs_where, rhs_having = self.resolve_boolean_conditions(rhs)

        is_where_condition: Callable[[list[WhereType]], bool] = lambda x: bool(
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
            and rhs_where
            and isinstance(rhs_where[0], Or)
            # Even in a long chain the first condition would be the next field
            and isinstance(rhs_where[0].conditions[0], Condition)
            and lhs_where[0].lhs == rhs_where[0].conditions[0].lhs
        ):
            self.tips["query"].add(constants.QUERY_TIPS["CHAINED_OR"])
        if operator == Or and (lhs_where or rhs_where) and (lhs_having or rhs_having):
            raise InvalidSearchQuery(
                "Having an OR between aggregate filters and normal filters is invalid."
            )

        where = self._combine_conditions(lhs_where, rhs_where, operator)
        having = self._combine_conditions(lhs_having, rhs_having, operator)

        return where, having

    def resolve_boolean_condition(
        self, term: event_filter.ParsedTerm
    ) -> tuple[list[WhereType], list[WhereType]]:
        if isinstance(term, event_search.ParenExpression):
            return self.resolve_boolean_conditions(term.children)

        where, having = [], []

        # I have no idea why but mypy thinks this is SearchFilter | SearchFilter, which is incompatible with SearchFilter...
        if isinstance(term, event_search.SearchFilter):
            where = self.resolve_where([cast(event_search.SearchFilter, term)])
        elif isinstance(term, event_search.AggregateFilter):
            having = self.resolve_having([cast(event_search.AggregateFilter, term)])

        return where, having

    def resolve_projects(self) -> list[int]:
        return self.params.project_ids

    def resolve_params(self) -> list[WhereType]:
        """Keys included as url params take precedent if same key is included in search
        They are also considered safe and to have had access rules applied unlike conditions
        from the query string.
        """
        conditions = []

        # Update start to be within retention
        expired = False
        if self.start and self.end:
            expired, self.start = outside_retention_with_modified_start(
                self.start, self.end, self.params.organization
            )

        if expired:
            raise QueryOutsideRetentionError(
                "Invalid date range. Please try a more recent date range."
            )

        if self.start:
            conditions.append(Condition(self.column("timestamp"), Op.GTE, self.start))
        if self.end:
            conditions.append(Condition(self.column("timestamp"), Op.LT, self.end))

        # project_ids is a required column for most datasets, however, Snuba does not
        # complain on an empty list which results on no data being returned.
        # This change will prevent calling Snuba when no projects are selected.
        # Snuba will complain with UnqualifiedQueryError: validation failed for entity...
        project_ids = self.resolve_projects()
        if not project_ids:
            # TODO: Fix the tests and always raise the error
            # In development, we will let Snuba complain about the lack of projects
            # so the developer can write their tests with a non-empty project list
            # In production, we will raise an error
            if not in_test_environment():
                raise UnqualifiedQueryError("You need to specify at least one project with data.")
        else:
            conditions.append(
                Condition(
                    self.column("project_id"),
                    Op.IN,
                    project_ids,
                )
            )

        if len(self.params.environments) > 0:
            term = event_search.SearchFilter(
                event_search.SearchKey("environment"),
                "=",
                event_search.SearchValue(self.params.environment_names),
            )
            condition = self._environment_filter_converter(term)
            if condition:
                conditions.append(condition)

        if self.requires_organization_condition:
            if self.params.organization is None:
                raise InvalidSearchQuery("Organization is a required parameter")

            conditions.append(
                Condition(
                    self.column(self.organization_column),
                    Op.EQ,
                    self.params.organization.id,
                )
            )

        return conditions

    def resolve_select(
        self, selected_columns: list[str] | None, equations: list[str] | None
    ) -> list[SelectType]:
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
                **(
                    self.builder_config.equation_config
                    if self.builder_config.equation_config
                    else {}
                ),
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
                and constants.PROJECT_THRESHOLD_CONFIG_ALIAS not in stripped_columns
            ):
                stripped_columns.append(constants.PROJECT_THRESHOLD_CONFIG_ALIAS)
                break

        for column in stripped_columns:
            if column == "":
                continue
            # need to make sure the column is resolved with the appropriate alias
            # because the resolved snuba name may be different
            resolved_column = self.resolve_column(column, alias=True)

            if resolved_column not in self.columns:
                resolved_columns.append(resolved_column)

        if self.builder_config.auto_fields:
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
        tag_match = constants.TAG_KEY_RE.search(raw_field)
        field = tag_match.group("tag") if tag_match else raw_field

        if constants.VALID_FIELD_PATTERN.match(field):
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
        match: Match[str] | None = None,
        resolve_only: bool = False,
        overwrite_alias: str | None = None,
    ) -> SelectType:
        """Given a public function, resolve to the corresponding Snql function


        :param function: the public alias for a function eg. "p50(transaction.duration)"
        :param match: the Match so we don't have to run the regex twice
        :param resolve_only: whether we should add the aggregate to self.aggregates
        :param overwrite_alias: ignore the alias in the parsed_function and use this string instead
        """
        if match is None:
            match = fields.is_function(function)

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

        if not snql_function.is_accessible(self.builder_config.functions_acl, combinator):
            raise InvalidSearchQuery(f"{snql_function.name}: no access to private function")

        combinator_applied = False

        arguments = snql_function.format_as_arguments(
            name, parsed_arguments, self.filter_params, combinator
        )

        self.function_alias_map[alias] = fields.FunctionDetails(
            function, snql_function, arguments.copy()
        )

        for arg in snql_function.args:
            if isinstance(arg, fields.ColumnArg):
                if (
                    arguments[arg.name] in fields.NumericColumn.numeric_array_columns
                    and isinstance(arg, fields.NumericColumn)
                    and not isinstance(combinator, fields.SnQLArrayCombinator)
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
        if snql_function.requires_other_aggregates:
            self.requires_other_aggregates = True

        return snql_function.snql_column(arguments, alias)

    def get_function_result_type(
        self,
        function: str,
    ) -> str | None:
        """Given a function, resolve it and then get the result_type

        params to this function should match that of resolve_function
        """
        resolved_function = self.resolve_function(function, resolve_only=True)

        if not isinstance(resolved_function, Function) or resolved_function.alias is None:
            return None

        function_details = self.function_alias_map.get(resolved_function.alias)
        if function_details is None:
            return None

        result_type: str | None = function_details.instance.get_result_type(
            function_details.field, function_details.arguments
        )
        return result_type

    def resolve_snql_function(
        self,
        snql_function: fields.SnQLFunction,
        arguments: Mapping[str, NormalizedArg],
        alias: str,
        resolve_only: bool,
    ) -> SelectType | None:
        if snql_function.snql_aggregate is not None:
            if not resolve_only:
                self.aggregates.append(snql_function.snql_aggregate(arguments, alias))
            return snql_function.snql_aggregate(arguments, alias)
        return None

    def resolve_equation(self, equation: Operation, alias: str | None = None) -> SelectType:
        """Convert this tree of Operations to the equivalent snql functions"""
        lhs = self._resolve_equation_operand(equation.lhs)
        rhs = self._resolve_equation_operand(equation.rhs)
        if equation.operator == "divide":
            rhs = Function("nullIf", [rhs, 0])
        return Function(equation.operator, [lhs, rhs], alias)

    def resolve_orderby(self, orderby: list[str] | str | None) -> list[OrderBy]:
        """Given a list of public aliases, optionally prefixed by a `-` to
        represent direction, construct a list of Snql Orderbys
        """
        validated: list[OrderBy] = []

        if orderby is None:
            return validated

        if isinstance(orderby, str):
            if not orderby:
                return validated

            orderby = [orderby]

        orderby_columns: list[str] = orderby if orderby else []

        resolved_orderby: str | SelectType | None
        for orderby in orderby_columns:
            bare_orderby = orderby.lstrip("-")
            bare_orderby = self.tag_to_prefixed_map.get(bare_orderby, bare_orderby)
            try:
                # Allow ordering equations with the calculated alias (ie. equation[0])
                if is_equation_alias(bare_orderby):
                    resolved_orderby = bare_orderby
                # Allow ordering equations directly with the raw alias (ie. equation|a + b)
                elif is_equation(bare_orderby):
                    if not strip_equation(bare_orderby):
                        raise InvalidSearchQuery("Cannot sort by an empty equation")
                    resolved_orderby = self.equation_alias_map[strip_equation(bare_orderby)]
                    bare_orderby = resolved_orderby.alias
                else:
                    resolved_orderby = self.resolve_column(bare_orderby)
            except (NotImplementedError, IncompatibleMetricsQuery):
                resolved_orderby = None

            direction = Direction.DESC if orderby.startswith("-") else Direction.ASC

            if fields.is_function(bare_orderby) and (
                isinstance(resolved_orderby, Function)
                or isinstance(resolved_orderby, CurriedFunction)
                or isinstance(resolved_orderby, AliasedExpression)
            ):
                bare_orderby = resolved_orderby.alias
            # tags that are typed have a different alias because we can't pass commas down
            elif bare_orderby in self.typed_tag_to_alias_map:
                bare_orderby = self.typed_tag_to_alias_map[bare_orderby]

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

    def resolve_column(self, field: NormalizedArg, alias: bool = False) -> SelectType:
        """Given a public field, construct the corresponding Snql, this
        function will determine the type of the field alias, whether its a
        column, field alias or function and call the corresponding resolver

        :param field: The public field string to resolve into Snql. This may
                      be a column, field alias, or even a function.
        :param alias: Whether or not the resolved column is aliased to the
                      original name. If false, it may still have an alias
                      but is not guaranteed.
        """
        if not isinstance(field, str):
            raise InvalidSearchQuery(f"{field} cannot be used as a column")
        match = fields.is_function(field)
        if match:
            return self.resolve_function(field, match)
        elif self.is_field_alias(field):
            return self.resolve_field_alias(field)
        else:
            return self.resolve_field(field, alias=alias)

    def resolve_groupby(self, groupby_columns: list[str] | None = None) -> list[SelectType]:
        self.validate_aggregate_arguments()
        if self.aggregates:
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
    def flattened_having(self) -> list[Condition]:
        """Return self.having as a flattened list ignoring boolean operators
        This is because self.having can have a mix of BooleanConditions and Conditions. And each BooleanCondition can in
        turn be a mix of either type.
        """
        flattened: list[Condition] = []
        boolean_conditions: list[BooleanCondition] = []

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

    @cached_property
    def custom_measurement_map(self) -> Sequence[MetricMeta]:
        # Both projects & org are required, but might be missing for the search parser
        if self.organization_id is None or not self.builder_config.has_metrics:
            return []

        from sentry.snuba.metrics.datasource import get_custom_measurements

        try:
            result: Sequence[MetricMeta] = get_custom_measurements(
                project_ids=self.params.project_ids,
                organization_id=self.organization_id,
                start=datetime.today() - timedelta(days=90),
                end=datetime.today(),
            )
        # Don't fully fail if we can't get the CM, but still capture the exception
        except Exception as error:
            sentry_sdk.capture_exception(error)
            return []
        return result

    def get_custom_measurement_names_set(self) -> set[str]:
        return {measurement["name"] for measurement in self.custom_measurement_map}

    def get_measurement_by_name(self, name: str) -> MetricMeta | None:
        # Skip the iteration if its not a measurement, which can save a custom measurement query entirely
        if not is_measurement(name):
            return None

        for measurement in self.custom_measurement_map:
            if measurement["name"] == name:
                return measurement
        return None

    def get_field_type(self, field: str) -> str | None:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if is_percentage_measurement(field):
            return "percentage"
        if is_numeric_measurement(field):
            return "number"

        if (
            field in self.duration_fields
            or is_duration_measurement(field)
            or is_span_op_breakdown(field)
        ):
            return "duration"

        if unit := self.size_fields.get(field):
            return unit

        measurement = self.get_measurement_by_name(field)
        # let the caller decide what to do
        if measurement is None:
            return None

        unit = measurement["unit"]
        if unit in constants.SIZE_UNITS or unit in constants.DURATION_UNITS:
            return unit
        elif unit == "none":
            return "integer"
        elif unit in constants.PERCENT_UNITS:
            return "percentage"
        else:
            return "number"

    def validate_having_clause(self) -> None:
        """Validate that the functions in having are selected columns

        Skipped if auto_aggregations are enabled, and at least one other aggregate is selected
        This is so we don't change grouping suddenly
        """

        conditions = self.flattened_having
        if self.builder_config.auto_aggregations and self.aggregates:
            for condition in conditions:
                lhs = condition.lhs
                if isinstance(lhs, CurriedFunction) and lhs not in self.columns:
                    self.columns.append(lhs)
                    self.aggregates.append(lhs)
            return
        # If auto aggregations is disabled or aggregations aren't present in the first place we throw an error
        else:
            error_extra = (
                ", and could not be automatically added"
                if self.builder_config.auto_aggregations
                else ""
            )
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
        # There might not be any columns during the resolve_groupby step
        if self.columns and self.requires_other_aggregates and len(self.aggregates) == 0:
            raise InvalidSearchQuery(
                "Another aggregate function needs to be selected in order to use the total.count field"
            )
        for column in self.columns:
            if column in self.aggregates:
                continue
            conflicting_functions: list[CurriedFunction] = []
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
                alias = column.name if isinstance(column, Column) else column.alias
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
        return AliasedExpression(column, self.tag_to_prefixed_map.get(name, name))

    def column(self, name: str) -> Column:
        """Given an unresolved sentry column name and return a snql column.

        :param name: The unresolved sentry name.
        """
        resolved_column = self.resolve_column_name(name)
        if self.entity:
            return Column(resolved_column, entity=self.entity)
        return Column(resolved_column)

    # Query filter helper methods
    def add_conditions(self, conditions: list[Condition]) -> None:
        self.where += conditions

    def parse_query(self, query: str | None) -> event_filter.ParsedTerms:
        """Given a user's query, string construct a list of filters that can be
        then used to construct the conditions of the Query"""
        if query is None:
            return []

        try:
            parsed_terms = event_search.parse_search_query(
                query,
                params=self.filter_params,
                builder=self,
                config_overrides=self.builder_config.parser_config_overrides,
            )
        except ParseError as e:
            if e.expr is not None:
                raise InvalidSearchQuery(f"Parse error: {e.expr.name} (column {e.column():d})")
            else:
                raise InvalidSearchQuery(f"Parse error for: {query}")

        if not parsed_terms:
            return []

        return parsed_terms

    def format_search_filter(self, term: event_search.SearchFilter) -> WhereType | None:
        converted_filter = self.convert_search_filter_to_condition(term)
        return converted_filter if converted_filter else None

    def _combine_conditions(
        self, lhs: list[WhereType], rhs: list[WhereType], operator: And | Or
    ) -> list[WhereType]:
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
        if unit in constants.SIZE_UNITS:
            return constants.SIZE_UNITS[cast(constants.SizeUnit, unit)] * value
        elif unit in constants.DURATION_UNITS:
            return constants.DURATION_UNITS[cast(constants.DurationUnit, unit)] * value
        return value

    def convert_aggregate_filter_to_condition(
        self, aggregate_filter: event_search.AggregateFilter
    ) -> WhereType | None:
        name = aggregate_filter.key.name
        value = aggregate_filter.value.value
        unit = self.get_function_result_type(aggregate_filter.key.name)
        if unit:
            value = self.resolve_measurement_value(unit, value)

        value = (
            int(value.timestamp()) if isinstance(value, datetime) and name != "timestamp" else value
        )

        if aggregate_filter.operator in {"=", "!="} and value == "":
            operator = Op.IS_NULL if aggregate_filter.operator == "=" else Op.IS_NOT_NULL
            return Condition(name, operator)

        # When resolving functions in conditions we don't want to add them to the list of aggregates
        function = self.resolve_function(name, resolve_only=True)

        return Condition(function, Op(aggregate_filter.operator), value)

    def convert_search_filter_to_condition(
        self,
        search_filter: event_search.SearchFilter,
    ) -> WhereType | None:
        name = search_filter.key.name
        value = search_filter.value.value
        if value and (unit := self.get_field_type(name)):
            if unit in constants.SIZE_UNITS or unit in constants.DURATION_UNITS:
                value = self.resolve_measurement_value(unit, value)
                search_filter = event_search.SearchFilter(
                    search_filter.key, search_filter.operator, event_search.SearchValue(value)
                )

        if name in constants.NO_CONVERSION_FIELDS:
            return None

        converter = self.search_filter_converter.get(name, self.default_filter_converter)
        return converter(search_filter)

    def validate_uuid_like_filters(self, search_filter: event_search.SearchFilter):
        name = search_filter.key.name
        value = search_filter.value

        if name in self.uuid_fields:
            if value.is_wildcard():
                raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(name))
            if not value.is_event_id():
                raise InvalidSearchQuery(INVALID_ID_DETAILS.format(name))

    def validate_span_id_like_filters(self, search_filter: event_search.SearchFilter):
        name = search_filter.key.name
        value = search_filter.value

        if name in self.span_id_fields:
            if value.is_wildcard():
                raise InvalidSearchQuery(WILDCARD_NOT_ALLOWED.format(name))
            if not value.is_span_id():
                raise InvalidSearchQuery(INVALID_SPAN_ID.format(name))

    def default_filter_converter(
        self, search_filter: event_search.SearchFilter
    ) -> WhereType | None:
        self.validate_uuid_like_filters(search_filter)
        self.validate_span_id_like_filters(search_filter)

        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        # Some fields aren't valid queries
        if name in constants.SKIP_FILTER_RESOLUTION:
            name = f"tags[{name}]"
        lhs = self.resolve_column(name)

        if name in constants.ARRAY_FIELDS:
            if search_filter.value.is_wildcard():
                # TODO: There are rare cases where this chaining don't
                # work. For example, a wildcard like '\**' will incorrectly
                # be replaced with '\%%'.
                return Condition(
                    lhs,
                    Op.LIKE if operator == "=" else Op.NOT_LIKE,
                    # Slashes have to be double escaped so they are
                    # interpreted as a string literal.
                    str(search_filter.value.raw_value)
                    .replace("\\", "\\\\")
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
        if isinstance(value, datetime) and name not in constants.TIMESTAMP_FIELDS:
            value = int(value.timestamp()) * 1000

        # Tags are never null, but promoted tags are columns and so can be null.
        # To handle both cases, use `ifNull` to convert to an empty string and
        # compare so we need to check for empty values.
        is_tag = isinstance(lhs, Column) and (
            lhs.subscriptable == "tags" or lhs.subscriptable == "sentry_tags"
        )
        is_attr = isinstance(lhs, Column) and (
            lhs.subscriptable == "attr_str" or lhs.subscriptable == "attr_num"
        )
        is_context = isinstance(lhs, Column) and lhs.subscriptable == "contexts"
        if is_tag or is_attr:
            subscriptable = lhs.subscriptable
            if operator not in ["IN", "NOT IN"] and not isinstance(value, str):
                sentry_sdk.set_tag("query.lhs", lhs)
                sentry_sdk.set_tag("query.rhs", value)
                sentry_sdk.capture_message("Tag value was not a string", level="error")
                value = str(value)
            lhs = Function("ifNull", [lhs, ""])
        else:
            subscriptable = None

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if is_tag or is_attr or is_context or name in self.config.non_nullable_keys:
                return Condition(lhs, Op(search_filter.operator), value)
            elif is_measurement(name):
                # Measurements can be a `Column` (e.g., `"lcp"`) or a `Function` (e.g., `"frames_frozen_rate"`). In either cause, since they are nullable, return a simple null check
                return Condition(
                    Function("isNull", [lhs]), Op.EQ, 1 if search_filter.operator == "=" else 0
                )
            elif isinstance(lhs, Column):
                # If not a tag, we can just check that the column is null.
                return Condition(Function("isNull", [lhs]), Op(search_filter.operator), 1)

        is_null_condition = None
        # TODO(wmak): Skip this for all non-nullable keys not just event.type
        if (
            search_filter.operator in ("!=", "NOT IN")
            and not search_filter.key.is_tag
            and not is_attr
            and not is_tag
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
            if self.config.optimize_wildcard_searches:
                kind, value_o = search_filter.value.classify_and_format_wildcard()
            else:
                kind, value_o = "other", search_filter.value.value

            if kind == "prefix":
                condition = Condition(
                    Function("startsWith", [Function("lower", [lhs]), value_o]),
                    Op.EQ if search_filter.operator in constants.EQUALITY_OPERATORS else Op.NEQ,
                    1,
                )
            elif kind == "suffix":
                condition = Condition(
                    Function("endsWith", [Function("lower", [lhs]), value_o]),
                    Op.EQ if search_filter.operator in constants.EQUALITY_OPERATORS else Op.NEQ,
                    1,
                )
            elif kind == "infix":
                condition = Condition(
                    Function("positionCaseInsensitive", [lhs, value_o]),
                    Op.NEQ if search_filter.operator in constants.EQUALITY_OPERATORS else Op.EQ,
                    0,
                )
            else:
                condition = Condition(
                    Function("match", [lhs, f"(?i){value}"]),
                    Op(search_filter.operator),
                    1,
                )

            if (
                self.config.optimize_wildcard_searches
                and subscriptable is not None
                and subscriptable in self.config.subscriptables_with_index
            ):
                # Some tables have a bloom filter index on the tags.key
                # column that can be used
                condition = And(
                    conditions=[
                        condition,
                        Condition(
                            Function(
                                "has",
                                [
                                    # Each dataset is responsible for making sure
                                    # the `{subscriptable}.key` is an available column
                                    self.resolve_column(f"{subscriptable}.key"),
                                    name,
                                ],
                            ),
                            Op.EQ,
                            1,
                        ),
                    ]
                )
        else:
            # pull out the aliased expression if it exists
            if isinstance(lhs, AliasedExpression):
                lhs = lhs.exp
            condition = Condition(lhs, Op(search_filter.operator), value)

        if is_null_condition:
            return Or(conditions=[is_null_condition, condition])
        else:
            return condition

    def _environment_filter_converter(
        self, search_filter: event_search.SearchFilter
    ) -> WhereType | None:
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
            operator = Op.EQ if search_filter.operator in constants.EQUALITY_OPERATORS else Op.NEQ
            env_conditions.append(Condition(environment, operator, values.pop()))
        elif values:
            operator = (
                Op.IN if search_filter.operator in constants.EQUALITY_OPERATORS else Op.NOT_IN
            )
            env_conditions.append(Condition(environment, operator, values))
        if len(env_conditions) > 1:
            return Or(conditions=env_conditions)
        else:
            return env_conditions[0]

    # Query Fields helper methods
    def _resolve_equation_operand(self, operand: OperandType | None) -> SelectType | float:
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

    def parse_function(self, match: Match[str]) -> tuple[str, str | None, list[str], str]:
        """Given a FUNCTION_PATTERN match, separate the function name, arguments
        and alias out
        """
        raw_function = match.group("function")
        function, combinator = fields.parse_combinator(raw_function)

        if not self.is_function(function):
            raise self.config.missing_function_error(f"{function} is not a valid function")

        arguments = fields.parse_arguments(function, match.group("columns"))
        alias: str | Any | None = match.group("alias")

        if alias is None:
            alias = fields.get_function_alias_with_columns(
                raw_function, arguments, self.function_alias_prefix
            )

        return (function, combinator, arguments, alias)

    def get_public_alias(self, function: CurriedFunction) -> str:
        """Given a function resolved by QueryBuilder, get the public alias of that function

        ie. any_user_display -> any(user_display)
        """
        return self.function_alias_map[function.alias].field

    def _get_entity_name(self) -> str:
        if self.dataset in DATASET_TO_ENTITY_MAP:
            return DATASET_TO_ENTITY_MAP[self.dataset].value
        return self.dataset.value

    def get_snql_query(self) -> Request:
        self.validate_having_clause()

        def check_tags(expression: Column | Function) -> bool:
            if isinstance(expression, Column):
                if (
                    expression.entity.name == "events"
                    and expression.name.startswith("tags[")
                    and expression.name.endswith("]")
                ):
                    return True
            elif isinstance(expression, Function):
                for parameter in expression.parameters:
                    if isinstance(parameter, (Column, Function)):
                        return check_tags(parameter)
            return False

        def check_tags_in_condition(condition: WhereType):
            if isinstance(condition, Condition):
                return check_tags(condition.lhs)
            elif isinstance(condition, BooleanCondition):
                return any(check_tags_in_condition(cond) for cond in condition.conditions)
            else:
                return False

        def replace_tags(expression: Column | Function) -> bool:
            if isinstance(expression, Column):
                if expression.name.startswith("tags[") and expression.name.endswith("]"):
                    return Column(
                        name=f"features[{expression.name[5:-1]}]",
                        entity=expression.entity,
                    )
            elif isinstance(expression, Function):
                for parameter in expression.parameters:
                    if isinstance(parameter, (Column, Function)):
                        return replace_tags(parameter)
            return expression

        def replace_tags_in_condition(condition: WhereType):
            if isinstance(condition, Condition):
                return replace_tags(condition.lhs)
            elif isinstance(condition, BooleanCondition):
                return any(replace_tags_in_condition(cond) for cond in condition.conditions)
            else:
                return False

        new_where = [
            (
                Or(
                    conditions=[
                        condition,
                        Condition(
                            lhs=replace_tags_in_condition(condition.lhs),
                            op=condition.op,
                            rhs=condition.rhs,
                        ),
                    ]
                )
                if check_tags_in_condition(condition.lhs)
                else condition
            )
            for condition in self.where
        ]

        query = Query(
            match=Entity(self._get_entity_name(), sample=self.sample_rate),
            select=self.columns,
            array_join=self.array_join,
            where=new_where,
            having=self.having,
            groupby=self.groupby,
            orderby=self.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
        )

        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=query,
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )

    def run_query(
        self, referrer: str | None, use_cache: bool = False, query_source: QuerySource | None = None
    ) -> Any:
        if not referrer:
            InvalidSearchQuery("Query missing referrer.")
        return raw_snql_query(self.get_snql_query(), referrer, use_cache, query_source)

    def process_results(self, results: Any) -> EventsResponse:
        with sentry_sdk.start_span(op="QueryBuilder", name="process_results") as span:
            span.set_data("result_count", len(results.get("data", [])))
            translated_columns = self.alias_to_typed_tag_map
            if self.builder_config.transform_alias_to_input_format:
                translated_columns.update(
                    {
                        column: function_details.field
                        for column, function_details in self.function_alias_map.items()
                    }
                )

                for column in list(self.function_alias_map):
                    translated_column = translated_columns.get(column, column)
                    if translated_column in self.function_alias_map:
                        continue
                    function_alias = self.function_alias_map.get(column)
                    if function_alias is not None:
                        self.function_alias_map[translated_column] = function_alias

                if self.raw_equations:
                    for index, equation in enumerate(self.raw_equations):
                        translated_columns[f"equation[{index}]"] = f"equation|{equation}"

            # process the field meta
            field_meta: dict[str, str] = {}
            if "meta" in results:
                for value in results["meta"]:
                    name = value["name"]
                    key = translated_columns.get(name, name)
                    key = self.prefixed_to_tag_map.get(key, key)
                    field_type = fields.get_json_meta_type(key, value.get("type"), self)
                    field_meta[key] = field_type
                # Ensure all columns in the result have types.
                if results["data"]:
                    for key in results["data"][0]:
                        field_key = translated_columns.get(key, key)
                        field_key = self.prefixed_to_tag_map.get(field_key, field_key)
                        if field_key not in field_meta:
                            field_meta[field_key] = "string"

            # process the field results
            def get_row(row: dict[str, Any]) -> dict[str, Any]:
                transformed = {}
                for key, value in row.items():
                    value = process_value(value)
                    if key in self.value_resolver_map:
                        new_value = self.value_resolver_map[key](value)
                    else:
                        new_value = value

                    resolved_key = translated_columns.get(key, key)
                    if not self.builder_config.skip_tag_resolution:
                        resolved_key = self.prefixed_to_tag_map.get(resolved_key, resolved_key)
                    transformed[resolved_key] = new_value

                return transformed

            return {
                "data": [get_row(row) for row in results["data"]],
                "meta": {
                    "fields": field_meta,
                    "tips": {},
                },
            }
