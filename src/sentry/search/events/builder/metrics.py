from collections import defaultdict
from datetime import datetime
from typing import Any, Callable, Dict, List, Mapping, Optional, Set, Tuple, Union

import sentry_sdk
from snuba_sdk import (
    AliasedExpression,
    Column,
    Condition,
    CurriedFunction,
    Direction,
    Entity,
    Flags,
    Function,
    Granularity,
    Limit,
    Offset,
    Op,
    Or,
    OrderBy,
    Query,
    Request,
)

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder import QueryBuilder
from sentry.search.events.filter import ParsedTerms
from sentry.search.events.types import (
    HistogramParams,
    ParamsType,
    QueryFramework,
    SelectType,
    WhereType,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.snuba.metrics.fields import histogram as metrics_histogram
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import DATASETS, Dataset, bulk_snql_query, raw_snql_query


class MetricsQueryBuilder(QueryBuilder):
    requires_organization_condition = True
    is_alerts_query = False
    organization_column: str = "organization_id"

    def __init__(
        self,
        *args: Any,
        # Datasets are currently a bit confusing; Dataset.Metrics is actually release health/sessions
        # Dataset.PerformanceMetrics is MEP. TODO: rename Dataset.Metrics to Dataset.ReleaseMetrics or similar
        dataset: Optional[Dataset] = None,
        allow_metric_aggregates: Optional[bool] = False,
        **kwargs: Any,
    ):
        self.distributions: List[CurriedFunction] = []
        self.sets: List[CurriedFunction] = []
        self.counters: List[CurriedFunction] = []
        self.metric_ids: Set[int] = set()
        self.allow_metric_aggregates = allow_metric_aggregates
        self._indexer_cache: Dict[str, Optional[int]] = {}
        # Don't do any of the actions that would impact performance in anyway
        # Skips all indexer checks, and won't interact with clickhouse
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
        org_id = self.filter_params.get("organization_id")
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
            tag_match = constants.TAG_KEY_RE.search(col)
            col = tag_match.group("tag") if tag_match else col
        if col in constants.METRIC_UNAVAILBLE_COLUMNS:
            raise IncompatibleMetricsQuery(f"{col} is unavailable")

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
        if self.is_performance:
            return f"tags_raw[{tag_id}]"
        else:
            return f"tags[{tag_id}]"

    def column(self, name: str) -> Column:
        """Given an unresolved sentry name and return a snql column.

        :param name: The unresolved sentry name.
        """
        missing_column = IncompatibleMetricsQuery(f"Column {name} was not found in metrics indexer")
        try:
            return super().column(name)
        except InvalidSearchQuery:
            raise missing_column

    def aliased_column(self, name: str) -> SelectType:
        missing_column = IncompatibleMetricsQuery(f"Column {name} was not found in metrics indexer")
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
        if limit is not None and limit > constants.METRICS_MAX_LIMIT:
            raise IncompatibleMetricsQuery(
                f"Can't have a limit larger than {constants.METRICS_MAX_LIMIT}"
            )
        elif limit is None:
            return Limit(constants.METRICS_MAX_LIMIT)
        else:
            return Limit(limit)

    def resolve_snql_function(
        self,
        snql_function: fields.MetricsFunction,
        arguments: Mapping[str, fields.NormalizedArg],
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
        if value not in self._indexer_cache:
            if self.is_performance:
                use_case_id = UseCaseKey.PERFORMANCE
            else:
                use_case_id = UseCaseKey.RELEASE_HEALTH
            result = indexer.resolve(use_case_id, self.organization_id, value)
            self._indexer_cache[value] = result

        return self._indexer_cache[value]

    def resolve_tag_value(self, value: str) -> Optional[Union[int, str]]:
        if self.is_performance or self.use_metrics_layer:
            return value
        return self.resolve_metric_index(value)

    def _default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
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
        if isinstance(value, datetime) and name not in constants.TIMESTAMP_FIELDS:
            value = int(to_timestamp(value)) * 1000

        if name in constants.TIMESTAMP_FIELDS:
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

        if search_filter.value.is_wildcard():
            return Condition(
                Function("match", [lhs, f"(?i){value}"]),
                Op(search_filter.operator),
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
        sorted_values = sorted(f"{value}" for value in values_set)
        values = []
        for value in sorted_values:
            if value:
                values.append(self._resolve_environment_filter_value(value))
            else:
                values.append("")
        values.sort()
        environment = self.column("environment")
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

    def get_metrics_layer_snql_query(self) -> Request:
        """
        This method returns the metrics layer snql of the query being fed into the transformer and then into the metrics
        layer.

        The snql query returned by this method is a dialect of snql only understood by the "mqb_query_transformer".
        This dialect has the same syntax as snql but has slightly different semantics and more operations.

        This dialect should NEVER be used outside of the transformer as it will create problems if parsed by the
        snuba SDK.
        """

        if not self.use_metrics_layer:
            # The reasoning for this error is because if "use_metrics_layer" is false, the MQB will not generate the
            # snql dialect explained below as there is not need for that because it will directly generate normal snql
            # that can be returned via the "get_snql_query" method.
            raise Exception("Cannot get metrics layer snql query when use_metrics_layer is false")

        self.validate_having_clause()
        self.validate_orderby_clause()

        prefix = "generic_" if self.dataset is Dataset.PerformanceMetrics else ""
        return Request(
            dataset=self.dataset.value,
            app_id="default",
            query=Query(
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
                granularity=self.granularity,
            ),
            flags=Flags(turbo=self.turbo),
            tenant_ids=self.tenant_ids,
        )

    def get_snql_query(self) -> Request:
        """
        This method returns the normal snql of the query being built for execution.
        """

        if self.use_metrics_layer:
            # The reasoning for this error is because if "use_metrics_layer" is true, the snql built within MQB will
            # be a slight variation of snql that is understood only by the "mqb_query_transformer" thus we don't
            # want to return it to users.
            # The usage of the transformer allows MQB to build a MetricsQuery automatically from the dialect of snql
            # defined by the transformer itself.
            raise NotImplementedError("Cannot get snql query when use_metrics_layer is true")

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
            tenant_ids=self.tenant_ids,
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
            ) or (isinstance(orderby.exp, Function) and orderby.exp.alias == "title"):
                raise IncompatibleMetricsQuery("Can't orderby tags")

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        if self.use_metrics_layer:
            from sentry.snuba.metrics.datasource import get_series
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            try:
                with sentry_sdk.start_span(op="metric_layer", description="transform_query"):
                    metric_query = transform_mqb_query_to_metrics_query(
                        self.get_metrics_layer_snql_query().query, self.is_alerts_query
                    )
                with sentry_sdk.start_span(op="metric_layer", description="run_query"):
                    metrics_data = get_series(
                        projects=self.params.projects,
                        metrics_query=metric_query,
                        use_case_id=UseCaseKey.PERFORMANCE
                        if self.is_performance
                        else UseCaseKey.RELEASE_HEALTH,
                        include_meta=True,
                        tenant_ids=self.tenant_ids,
                    )
            except Exception as err:
                raise IncompatibleMetricsQuery(err)
            with sentry_sdk.start_span(op="metric_layer", description="transform_results"):
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

        self.validate_having_clause()
        self.validate_orderby_clause()
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
                    tenant_ids=self.tenant_ids,
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
    is_alerts_query = True

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

    def get_snql_query(self) -> Request:
        """
        We are overriding this method here because in the case of alerts, we would like to use the snql query
        generated by the metrics layer. This implementation goes against the rationale of the metrics layer and should
        be removed as soon as snuba subscriptions will be supported by the layer.
        The logic behind this method is that MetricsQueryBuilder will generate a dialect of snql via the
        "get_metrics_layer_snql_query()" method, which will be fed into the transformer that will generate
        the MetricsQuery which is the DSL of querying that the metrics layer understands. Once this is generated,
        we are going to import the purposfully hidden SnubaQueryBuilder which is a component that takes a MetricsQuery
        and returns one or more equivalent snql query(ies).
        """

        if self.use_metrics_layer:
            from sentry.snuba.metrics import SnubaQueryBuilder
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            snuba_request = self.get_metrics_layer_snql_query()
            snuba_queries, _ = SnubaQueryBuilder(
                projects=self.params.projects,
                metrics_query=transform_mqb_query_to_metrics_query(
                    snuba_request.query, is_alerts_query=self.is_alerts_query
                ),
                use_case_id=UseCaseKey.PERFORMANCE
                if self.is_performance
                else UseCaseKey.RELEASE_HEALTH,
            ).get_snuba_queries()

            if len(snuba_queries) != 1:
                # If we have have zero or more than one queries resulting from the supplied query, we want to generate
                # an error as we don't support this case.
                raise IncompatibleMetricsQuery(
                    "The metrics layer generated zero or multiple queries from the supplied query, only a single query is supported"
                )

            # We take only the first query, supposing a single query is generated.
            entity = list(snuba_queries.keys())[0]
            snuba_request.query = snuba_queries[entity]["totals"]

            return snuba_request

        return super().get_snql_query()


class HistogramMetricQueryBuilder(MetricsQueryBuilder):
    base_function_acl = ["histogram"]

    def __init__(
        self,
        histogram_params: HistogramParams,
        *args: Any,
        **kwargs: Any,
    ):
        self.histogram_aliases: List[str] = []
        self.num_buckets = histogram_params.num_buckets
        self.min_bin = histogram_params.start_offset
        self.max_bin = (
            histogram_params.start_offset + histogram_params.bucket_size * self.num_buckets
        )

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
        limit: Optional[int] = 10000,
        use_metrics_layer: Optional[bool] = False,
        groupby: Optional[Column] = None,
    ):
        super().__init__(
            params=params,
            query=query,
            dataset=dataset,
            selected_columns=selected_columns,
            allow_metric_aggregates=allow_metric_aggregates,
            auto_fields=False,
            functions_acl=functions_acl,
            use_metrics_layer=use_metrics_layer,
        )
        if self.granularity.granularity > interval:
            for granularity in constants.METRICS_GRANULARITIES:
                if granularity < interval:
                    self.granularity = Granularity(granularity)
                    break

        self.time_column = self.resolve_time_column(interval)
        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the implied groupby will always be time
        self.groupby = [self.time_column]

        # If additional groupby is provided it will be used first before time
        if groupby is not None:
            self.groupby.insert(0, groupby)

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
        if self.use_metrics_layer:
            prefix = "generic_" if self.dataset is Dataset.PerformanceMetrics else ""

            return [
                Request(
                    dataset=self.dataset.value,
                    app_id="default",
                    query=Query(
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
                        orderby=[],
                        granularity=self.granularity,
                    ),
                    tenant_ids=self.tenant_ids,
                )
            ]
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
                        tenant_ids=self.tenant_ids,
                    )
                )

        return queries

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        if self.use_metrics_layer:
            from sentry.snuba.metrics.datasource import get_series
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            snuba_query = self.get_snql_query()[0].query
            try:
                with sentry_sdk.start_span(op="metric_layer", description="transform_query"):
                    metric_query = transform_mqb_query_to_metrics_query(
                        snuba_query, self.is_alerts_query
                    )
                with sentry_sdk.start_span(op="metric_layer", description="run_query"):
                    metrics_data = get_series(
                        projects=self.params.projects,
                        metrics_query=metric_query,
                        use_case_id=UseCaseKey.PERFORMANCE
                        if self.is_performance
                        else UseCaseKey.RELEASE_HEALTH,
                        include_meta=True,
                        tenant_ids=self.tenant_ids,
                    )
            except Exception as err:
                raise IncompatibleMetricsQuery(err)
            with sentry_sdk.start_span(op="metric_layer", description="transform_results"):
                metric_layer_result: Any = {
                    "data": [],
                    "meta": metrics_data["meta"],
                }
                # metric layer adds bucketed time automatically but doesn't remove it
                for meta in metric_layer_result["meta"]:
                    if meta["name"] == "bucketed_time":
                        meta["name"] = "time"
                for index, interval in enumerate(metrics_data["intervals"]):
                    # the metric layer changes the intervals to datetime objects when we want the isoformat
                    data = {self.time_alias: interval.isoformat()}
                    # only need the first thing in groups since we don't groupby
                    for key, value_list in (
                        metrics_data.get("groups", [{}])[0].get("series", {}).items()
                    ):
                        data[key] = value_list[index]
                    metric_layer_result["data"].append(data)
                    for meta in metric_layer_result["meta"]:
                        if meta["name"] not in data:
                            data[meta["name"]] = self.get_default_value(meta["type"])

                return metric_layer_result

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
