from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Set, Tuple, Union

import sentry_sdk
from django.utils.functional import cached_property
from snuba_sdk import (
    AliasedExpression,
    And,
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
from sentry.search.events.builder.utils import (
    adjust_datetime_to_granularity,
    optimal_granularity_for_date_range,
    remove_hours,
    remove_minutes,
)
from sentry.search.events.fields import get_function_alias
from sentry.search.events.filter import ParsedTerms
from sentry.search.events.types import (
    HistogramParams,
    NormalizedArg,
    ParamsType,
    QueryBuilderConfig,
    QueryFramework,
    SelectType,
    WhereType,
)
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import create_result_key
from sentry.snuba.metrics.extraction import (
    QUERY_HASH_KEY,
    OnDemandMetricSpec,
    should_use_on_demand_metrics,
)
from sentry.snuba.metrics.fields import histogram as metrics_histogram
from sentry.snuba.metrics.query import MetricField, MetricsQuery
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import DATASETS, bulk_snql_query, raw_snql_query


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
        granularity: Optional[int] = None,
        config: Optional[QueryBuilderConfig] = None,
        **kwargs: Any,
    ):
        if config is None:
            config = QueryBuilderConfig()
        kwargs["config"] = config
        self.distributions: List[CurriedFunction] = []
        self.sets: List[CurriedFunction] = []
        self.counters: List[CurriedFunction] = []
        self.percentiles: List[CurriedFunction] = []
        # only used for metrics_layer right now
        self.metrics_layer_functions: List[CurriedFunction] = []
        self.metric_ids: Set[int] = set()
        self._indexer_cache: Dict[str, Optional[int]] = {}
        # always true if this is being called
        config.has_metrics = True
        assert dataset is None or dataset in [Dataset.PerformanceMetrics, Dataset.Metrics]

        if granularity is not None:
            self._granularity = granularity

        super().__init__(
            # TODO: defaulting to Metrics for now so I don't have to update incidents tests. Should be
            # PerformanceMetrics
            Dataset.Metrics if dataset is None else dataset,
            *args,
            **kwargs,
        )

        org_id = self.filter_params.get("organization_id")
        if org_id is None and self.params.organization is not None:
            org_id = self.params.organization.id
        if org_id is None or not isinstance(org_id, int):
            raise InvalidSearchQuery("Organization id required to create a metrics query")
        self.organization_id: int = org_id

    def are_columns_resolved(self) -> bool:
        # If we have an on demand spec, we want to mark the columns as resolved, since we are not running the
        # `resolve_query` method.
        if self._on_demand_metric_spec:
            return True

        return super().are_columns_resolved()

    @cached_property
    def _on_demand_metric_spec(self) -> Optional[OnDemandMetricSpec]:
        if not self.builder_config.on_demand_metrics_enabled:
            return None

        field = self.selected_columns[0] if self.selected_columns else None
        if not field:
            return None

        if self.query is None:
            return None

        if not should_use_on_demand_metrics(self.dataset, field, self.query):
            return None

        try:
            return OnDemandMetricSpec(field, self.query)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None

    def _get_metrics_query_from_on_demand_spec(
        self, spec: OnDemandMetricSpec, require_time_range: bool = True
    ) -> MetricsQuery:
        if self.params.organization is None:
            raise InvalidSearchQuery("An on demand metrics query requires an organization")

        if len(self.selected_columns) == 0:
            raise InvalidSearchQuery(
                "An on demand metrics query requires at least one selected column"
            )

        if isinstance(self, TimeseriesMetricQueryBuilder):
            limit = Limit(1)
            alias = get_function_alias(self.selected_columns[0]) or "count"
            include_series = True
            interval = self.interval
        else:
            limit = self.limit or Limit(1)
            alias = spec.mri
            include_series = False
            interval = None

        # Since the query builder is very convoluted, we first try to get the start and end from the validated
        # parameters but in case it's none it can be that the `skip_time_conditions` was True, thus in that case we
        # try to see if start and end were supplied directly in the constructor.
        start = self.start or self.params.start
        end = self.end or self.params.end

        # The time range can be required or not, since the query generated by the builder can either be used to execute
        # the query on its own (requiring a time range) or it can be used to get the snql code necessary to create a
        # query subscription from the outside.
        if require_time_range and (start is None or end is None):
            raise InvalidSearchQuery(
                "The on demand metric query requires a time range to be executed"
            )
        where = [
            Condition(
                lhs=Column(QUERY_HASH_KEY),
                op=Op.EQ,
                rhs=spec.query_hash,
            ),
        ]

        if self.params.environments:
            environment = self.params.environments[0].name
            where.append(
                Condition(
                    Column("environment"),
                    Op.EQ,
                    environment,
                )
            )

        return MetricsQuery(
            select=[MetricField(spec.op, spec.mri, alias=alias)],
            where=where,
            limit=limit,
            offset=self.offset,
            granularity=self.granularity,
            interval=interval,
            is_alerts_query=True,
            org_id=self.params.organization.id,
            project_ids=[p.id for p in self.params.projects],
            include_series=include_series,
            start=start,
            end=end,
        )

    def validate_aggregate_arguments(self) -> None:
        if not self.builder_config.use_metrics_layer:
            super().validate_aggregate_arguments()

    @property
    def is_performance(self) -> bool:
        return self.dataset is Dataset.PerformanceMetrics

    @property
    def use_case_id(self) -> UseCaseID:
        if self.is_performance:
            return UseCaseID.TRANSACTIONS
        elif self.spans_metrics_builder:
            return UseCaseID.SPANS
        else:
            return UseCaseID.SESSIONS

    def resolve_query(
        self,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        groupby_columns: Optional[List[str]] = None,
        equations: Optional[List[str]] = None,
        orderby: Optional[List[str]] = None,
    ) -> None:
        # Resolutions that we always must perform, irrespectively of on demand.
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_time_conditions"):
            # Has to be done early, since other conditions depend on start and end
            self.resolve_time_conditions()
        with sentry_sdk.start_span(op="QueryBuilder", description="resolve_granularity"):
            # Needs to happen before params and after time conditions since granularity can change start&end
            self.granularity = self.resolve_granularity()
            if self.start is not None:
                self.start = adjust_datetime_to_granularity(
                    self.start, self.granularity.granularity
                )

        # Resolutions that we will perform only in case the query is not on demand. The reasoning for this is that
        # for building an on demand query we only require a time interval and granularity. All the other fields are
        # automatically computed given the OnDemandMetricSpec.
        if not self._on_demand_metric_spec:
            with sentry_sdk.start_span(op="QueryBuilder", description="resolve_conditions"):
                self.where, self.having = self.resolve_conditions(query)
            with sentry_sdk.start_span(op="QueryBuilder", description="resolve_params"):
                # params depends on parse_query, and conditions being resolved first since there may be projects
                # in conditions
                self.where += self.resolve_params()
            with sentry_sdk.start_span(op="QueryBuilder", description="resolve_columns"):
                self.columns = self.resolve_select(selected_columns, equations)
            with sentry_sdk.start_span(op="QueryBuilder", description="resolve_orderby"):
                self.orderby = self.resolve_orderby(orderby)
            with sentry_sdk.start_span(op="QueryBuilder", description="resolve_groupby"):
                self.groupby = self.resolve_groupby(groupby_columns)

        if len(self.metric_ids) > 0 and not self.builder_config.use_metrics_layer:
            self.where.append(
                # Metric id is intentionally sorted, so we create consistent queries here both for testing & caching.
                Condition(Column("metric_id"), Op.IN, sorted(self.metric_ids))
            )

    def resolve_column_name(self, col: str) -> str:
        if col.startswith("tags["):
            tag_match = constants.TAG_KEY_RE.search(col)
            col = tag_match.group("tag") if tag_match else col

        # on-demand metrics require metrics layer behavior
        if self.builder_config.use_metrics_layer or self._on_demand_metric_spec:
            if col in ["project_id", "timestamp"]:
                return col
            # TODO: update resolve params so this isn't needed
            if col == "organization_id":
                return "org_id"
            if col == "transaction":
                self.has_transaction = True
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

        In special cases granularity can be set manually bypassing the granularity calculation below.
        """
        if hasattr(self, "_granularity") and getattr(self, "_granularity") is not None:
            return Granularity(self._granularity)

        if self.end is None or self.start is None:
            raise ValueError("skip_time_conditions must be False when calling this method")

        granularity = optimal_granularity_for_date_range(self.start, self.end)
        return Granularity(granularity)

    def resolve_split_granularity(self) -> Tuple[List[Condition], Optional[Granularity]]:
        """This only is applicable to table queries, we can use multiple granularities across the time period, which
        should improve performance"""
        if self.end is None or self.start is None:
            raise ValueError("skip_time_conditions must be False when calling this method")

        # Only split granularity when granularity is 1h or 1m
        # This is cause if its 1d we're already as efficient as possible, but we could add 1d in the future if there are
        # accuracy issues
        if self.granularity.granularity == 86400:
            return [], self.granularity
        granularity = self.granularity.granularity
        self.granularity = None

        if granularity == constants.METRICS_GRANULARITY_MAPPING["1m"]:
            rounding_function = remove_minutes
            base_granularity = constants.METRICS_GRANULARITY_MAPPING["1m"]
            core_granularity = constants.METRICS_GRANULARITY_MAPPING["1h"]
        elif granularity == constants.METRICS_GRANULARITY_MAPPING["1h"]:
            rounding_function = remove_hours
            base_granularity = constants.METRICS_GRANULARITY_MAPPING["1h"]
            core_granularity = constants.METRICS_GRANULARITY_MAPPING["1d"]
        else:
            return [], Granularity(granularity)

        if rounding_function(self.start, False) > rounding_function(self.end):
            return [], Granularity(granularity)
        timestamp = self.column("timestamp")
        granularity = Column("granularity")
        return [
            Or(
                [
                    # Grab the buckets that the core_granularity won't be able to capture at the original granularity
                    And(
                        [
                            Or(
                                [
                                    # We won't grab outside the queries timewindow because there's still a toplevel
                                    # filter
                                    Condition(timestamp, Op.GTE, rounding_function(self.end)),
                                    Condition(
                                        timestamp, Op.LT, rounding_function(self.start, False)
                                    ),
                                ]
                            ),
                            Condition(granularity, Op.EQ, base_granularity),
                        ]
                    ),
                    # Grab the buckets that can use the core_granularity
                    And(
                        [
                            Condition(timestamp, Op.GTE, rounding_function(self.start, False)),
                            # This op is LT not LTE, here's an example why; a query is from 11:45 to 15:45
                            # if an event happened at 15:02, its caught by the above condition in the 1min bucket at
                            # 15:02, but its also caught at the 1hr bucket at 15:00
                            Condition(timestamp, Op.LT, rounding_function(self.end)),
                            Condition(granularity, Op.EQ, core_granularity),
                        ]
                    ),
                ]
            )
        ], None

    def resolve_having(self, parsed_terms: ParsedTerms) -> List[WhereType]:
        if not self.builder_config.allow_metric_aggregates:
            # Regardless of use_aggregate_conditions, check if any having_conditions exist
            use_aggregate_conditions = self.builder_config.use_aggregate_conditions
            self.builder_config.use_aggregate_conditions = True
            having_conditions = super().resolve_having(parsed_terms)
            self.builder_config.use_aggregate_conditions = use_aggregate_conditions
            if len(having_conditions) > 0:
                raise IncompatibleMetricsQuery(
                    "Aggregate conditions were disabled, but included in filter"
                )

            # Don't resolve having conditions again if we don't have to
            if self.builder_config.use_aggregate_conditions:
                return having_conditions
            else:
                return []
        return super().resolve_having(parsed_terms)

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
        arguments: Mapping[str, NormalizedArg],
        alias: str,
        resolve_only: bool,
    ) -> Optional[SelectType]:
        if snql_function.snql_distribution is not None:
            resolved_function = snql_function.snql_distribution(arguments, alias)
            if not resolve_only:
                if snql_function.is_percentile:
                    self.percentiles.append(resolved_function)
                else:
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
                if snql_function.is_percentile:
                    self.percentiles.append(resolved_function)
                else:
                    self.metrics_layer_functions.append(resolved_function)
            return resolved_function
        return None

    def resolve_metric_index(self, value: str) -> Optional[int]:
        """Layer on top of the metric indexer so we'll only hit it at most once per value"""
        if value not in self._indexer_cache:
            result = indexer.resolve(self.use_case_id, self.organization_id, value)
            self._indexer_cache[value] = result

        return self._indexer_cache[value]

    def resolve_tag_value(self, value: str) -> Optional[Union[int, str]]:
        if self.is_performance or self.builder_config.use_metrics_layer:
            return value
        return self.resolve_metric_index(value)

    def default_filter_converter(self, search_filter: SearchFilter) -> Optional[WhereType]:
        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            if name in constants.METRICS_MAP:
                if search_filter.operator == "!=":
                    return None
                else:
                    raise IncompatibleMetricsQuery("!has isn't compatible with metrics queries")
            else:
                return Condition(
                    Function("has", [Column("tags.key"), self.resolve_metric_index(name)]),
                    Op.EQ if search_filter.operator == "!=" else Op.NEQ,
                    1,
                )

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
                    if (
                        resolved_item is None
                        and not self.builder_config.skip_field_validation_for_entity_subscription_deletion
                    ):
                        raise IncompatibleMetricsQuery(f"{name} value {item} in filter not found")
                    resolved_value.append(resolved_item)
                value = resolved_value
            else:
                resolved_item = self.resolve_tag_value(value)
                if (
                    resolved_item is None
                    and not self.builder_config.skip_field_validation_for_entity_subscription_deletion
                ):
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

    def get_metrics_layer_snql_query(
        self,
        query_framework: Optional[QueryFramework] = None,
        extra_conditions: Optional[List[Condition]] = None,
    ) -> Query:
        """
        This method returns the metrics layer snql of the query being fed into the transformer and then into the metrics
        layer.

        The snql query returned by this method is a dialect of snql only understood by the "mqb_query_transformer".
        This dialect has the same syntax as snql but has slightly different semantics and more operations.

        This dialect should NEVER be used outside of the transformer as it will create problems if parsed by the
        snuba SDK.
        """
        if (
            not self.builder_config.use_metrics_layer
            and not self.builder_config.on_demand_metrics_enabled
        ):
            # The reasoning for this error is because if "use_metrics_layer" is false, the MQB will not generate the
            # snql dialect explained below as there is not need for that because it will directly generate normal snql
            # that can be returned via the "get_snql_query" method.
            raise Exception("Cannot get metrics layer snql query when use_metrics_layer is false")

        self.validate_having_clause()

        prefix = "generic_" if self.dataset is Dataset.PerformanceMetrics else ""
        return Query(
            match=Entity(f"{prefix}metrics_distributions", sample=self.sample_rate),
            # Metrics doesn't support columns in the select, and instead expects them in the groupby
            select=(self.aggregates if query_framework is None else query_framework.functions)
            + [
                # Team key transaction is a special case sigh
                col
                for col in self.columns
                if isinstance(col, Function) and col.function == "team_key_transaction"
            ],
            array_join=self.array_join,
            where=self.where + (extra_conditions if extra_conditions else []),
            having=self.having if query_framework is None else query_framework.having,
            groupby=self.groupby,
            orderby=self.orderby if query_framework is None else query_framework.orderby,
            limit=self.limit,
            offset=self.offset,
            limitby=self.limitby,
            granularity=self.granularity,
        )

    def get_snql_query(self) -> Request:
        """
        This method returns the normal snql of the query being built for execution.
        """
        if self.builder_config.use_metrics_layer:
            # The reasoning for this error is because if "use_metrics_layer" is true, the snql built within MQB will
            # be a slight variation of snql that is understood only by the "mqb_query_transformer" thus we don't
            # want to return it to users.
            # The usage of the transformer allows MQB to build a MetricsQuery automatically from the dialect of snql
            # defined by the transformer itself.
            raise NotImplementedError("Cannot get snql query when use_metrics_layer is true")

        self.validate_having_clause()

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

    def _get_base_query_framework(self) -> Dict[str, QueryFramework]:
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
            "metrics_layer": QueryFramework(
                orderby=[],
                having=[],
                functions=self.metrics_layer_functions,
                entity=Entity(f"{prefix}metrics_distributions", sample=self.sample_rate),
            ),
            # Percentiles are a part of distributions but they're expensive, treat them as their own entity so we'll run
            # a query with the cheap distributions first then only get page_size quantiles
            "percentiles": QueryFramework(
                orderby=[],
                having=[],
                functions=self.percentiles,
                entity=Entity(f"{prefix}metrics_distributions", sample=self.sample_rate),
            ),
        }
        return query_framework

    def _create_query_framework(self) -> Tuple[str, Dict[str, QueryFramework]]:
        query_framework = self._get_base_query_framework()
        primary = None
        # if orderby spans more than one table, the query isn't possible with metrics
        for orderby in self.orderby:
            for entity, framework in query_framework.items():
                # Metrics layer can't have aliases in the functions for some reason
                if self.builder_config.use_metrics_layer:
                    framework_functions = [
                        function.exp if isinstance(function, AliasedExpression) else function
                        for function in framework.functions
                    ]
                else:
                    framework_functions = framework.functions
                if orderby.exp in framework_functions:
                    framework.orderby.append(orderby)
                    if primary not in [None, entity]:
                        raise IncompatibleMetricsQuery("Can't order across tables")
                    primary = entity
                    break
            else:
                # An orderby that isn't on a function add it to all of them
                for framework in query_framework.values():
                    framework.orderby.append(orderby)

        having_entity: Optional[str] = None
        for condition in self.flattened_having:
            for entity, framework in query_framework.items():
                if condition.lhs in framework.functions:
                    if having_entity is None:
                        having_entity = entity
                    elif having_entity != entity:
                        raise IncompatibleMetricsQuery(
                            "Can only have aggregate conditions on one entity"
                        )
                    break

        if primary is not None and having_entity is not None and having_entity != primary:
            raise IncompatibleMetricsQuery(
                "Can't use a having condition on non primary distribution"
            )

        # Pick one arbitrarily, there's no orderby on functions
        if primary is None:
            if having_entity is not None:
                primary = having_entity
            else:
                for entity, framework in query_framework.items():
                    if len(framework.functions) > 0:
                        primary = entity
                        break
                else:
                    raise IncompatibleMetricsQuery("Need at least one function")

        query_framework[primary].having = self.having

        return primary, query_framework

    def convert_metric_layer_result(self, metrics_data: Any) -> Any:
        """The metric_layer returns results in a non-standard format, this function changes it back to the expected
        one"""
        with sentry_sdk.start_span(op="metric_layer", description="transform_results"):
            metric_layer_result: Any = {
                "data": [],
                "meta": metrics_data["meta"],
            }
            for group in metrics_data["groups"]:
                data = group["by"]
                data.update(group["totals"])
                metric_layer_result["data"].append(data)
                for meta in metric_layer_result["meta"]:
                    if data.get(meta["name"]) is None:
                        data[meta["name"]] = self.get_default_value(meta["type"])

        return metric_layer_result

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        groupby_aliases = [
            groupby.alias
            if isinstance(groupby, (AliasedExpression, CurriedFunction))
            else groupby.name
            for groupby in self.groupby
            if not (
                isinstance(groupby, CurriedFunction) and groupby.function == "team_key_transaction"
            )
        ]
        # The typing for these are weak (all using Any) since the results from snuba can contain an assortment of types
        value_map: Dict[str, Any] = defaultdict(dict)
        groupby_values: List[Any] = []
        meta_dict = {}
        result: Any = {
            "data": None,
            "meta": [],
        }

        # Check if we need to make multiple queries
        if not self._on_demand_metric_spec:
            primary, query_framework = self._create_query_framework()
        else:
            primary = "metrics_layer"
            query_framework = {
                primary: QueryFramework(
                    orderby=[],
                    having=[],
                    functions=self.metrics_layer_functions,
                    entity=Entity("generic_metrics_distributions", sample=self.sample_rate),
                )
            }

        self.tenant_ids = self.tenant_ids or dict()
        self.tenant_ids["use_case_id"] = self.use_case_id.value

        if self.builder_config.use_metrics_layer or self._on_demand_metric_spec:
            from sentry.snuba.metrics.datasource import get_series
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            for query_details in [query_framework.pop(primary), *query_framework.values()]:
                if len(query_details.functions) == 0 and not self._on_demand_metric_spec:
                    continue
                if groupby_values:
                    extra_conditions = [
                        Condition(
                            # Tuples are allowed to have multiple types in clickhouse
                            Function(
                                "tuple",
                                [
                                    groupby.exp
                                    if isinstance(groupby, AliasedExpression)
                                    else groupby
                                    for groupby in self.groupby
                                    if not (
                                        isinstance(groupby, CurriedFunction)
                                        and groupby.function == "team_key_transaction"
                                    )
                                ],
                            ),
                            Op.IN,
                            Function("tuple", groupby_values),
                        )
                    ]
                else:
                    extra_conditions = None
                try:
                    with sentry_sdk.start_span(op="metric_layer", description="transform_query"):
                        if self._on_demand_metric_spec:
                            metrics_query = self._get_metrics_query_from_on_demand_spec(
                                spec=self._on_demand_metric_spec, require_time_range=True
                            )
                        else:
                            metrics_query = transform_mqb_query_to_metrics_query(
                                self.get_metrics_layer_snql_query(query_details, extra_conditions),
                                self.is_alerts_query,
                            )
                    with sentry_sdk.start_span(op="metric_layer", description="run_query"):
                        metrics_data = get_series(
                            projects=self.params.projects,
                            metrics_query=metrics_query,
                            use_case_id=UseCaseID.TRANSACTIONS
                            if self.is_performance
                            else UseCaseID.SESSIONS,
                            include_meta=True,
                            tenant_ids=self.tenant_ids,
                        )
                except Exception as err:
                    raise IncompatibleMetricsQuery(err)
                with sentry_sdk.start_span(op="metric_layer", description="transform_results"):
                    metric_layer_result = self.convert_metric_layer_result(metrics_data)
                    for row in metric_layer_result["data"]:
                        # Arrays in clickhouse cannot contain multiple types, and since groupby values
                        # can contain any type, we must use tuples instead
                        groupby_key = tuple(row[key] for key in groupby_aliases)
                        value_map_key = ",".join(str(value) for value in groupby_key)
                        # First time we're seeing this value, add it to the values we're going to filter by
                        if value_map_key not in value_map and groupby_key:
                            groupby_values.append(groupby_key)
                        value_map[value_map_key].update(row)
                    for meta in metric_layer_result["meta"]:
                        meta_dict[meta["name"]] = meta["type"]
        else:
            self.validate_having_clause()

            # TODO: this should happen regardless of whether the metrics_layer is being used
            granularity_condition, new_granularity = self.resolve_split_granularity()
            self.granularity = new_granularity
            self.where += granularity_condition

            # We need to run the same logic on all 3 queries, since the `primary` query could come back with no results. The
            # goal is to get n=limit results from one query, then use those n results to create a condition for the
            # remaining queries. This is so that we can respect function orderbys from the first query, but also so we don't
            # get 50 different results from each entity
            for query_details in [query_framework.pop(primary), *query_framework.values()]:
                # Only run the query if there's at least one function, can't query without metrics
                if len(query_details.functions) == 0:
                    continue
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
        if self.builder_config.use_metrics_layer or self._on_demand_metric_spec:
            from sentry.snuba.metrics import SnubaQueryBuilder
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            if self._on_demand_metric_spec:
                metrics_query = self._get_metrics_query_from_on_demand_spec(
                    spec=self._on_demand_metric_spec, require_time_range=False
                )
            else:
                intermediate_query = self.get_metrics_layer_snql_query()
                metrics_query = transform_mqb_query_to_metrics_query(
                    intermediate_query, is_alerts_query=self.is_alerts_query
                )

            snuba_queries, _ = SnubaQueryBuilder(
                projects=self.params.projects,
                metrics_query=metrics_query,
                use_case_id=UseCaseID.TRANSACTIONS if self.is_performance else UseCaseID.SESSIONS,
            ).get_snuba_queries()

            if len(snuba_queries) != 1:
                # If we have zero or more than one queries resulting from the supplied query, we want to generate
                # an error as we don't support this case.
                raise IncompatibleMetricsQuery(
                    "The metrics layer generated zero or multiple queries from the supplied query, only a single "
                    "query is supported"
                )

            # We take only the first query, supposing a single query is generated.
            entity = list(snuba_queries.keys())[0]
            query = snuba_queries[entity]["totals"]

            return Request(
                dataset=self.dataset.value,
                app_id="default",
                query=query,
                flags=Flags(turbo=self.turbo),
                tenant_ids=self.tenant_ids,
            )

        return super().get_snql_query()

    def resolve_split_granularity(self) -> Tuple[List[Condition], Optional[Granularity]]:
        """Don't do this for anything but table queries"""
        return [], self.granularity


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

        config = kwargs.get("config", QueryBuilderConfig())
        functions_acl = config.functions_acl if config.functions_acl else []
        config.functions_acl = functions_acl + self.base_function_acl
        kwargs["config"] = config
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

    def resolve_split_granularity(self) -> Tuple[List[Condition], Optional[Granularity]]:
        """Don't do this for anything but table queries"""
        return [], self.granularity


class TimeseriesMetricQueryBuilder(MetricsQueryBuilder):
    time_alias = "time"

    def __init__(
        self,
        params: ParamsType,
        interval: int,
        dataset: Optional[Dataset] = None,
        query: Optional[str] = None,
        selected_columns: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
        groupby: Optional[Column] = None,
        config: Optional[QueryBuilderConfig] = None,
    ):
        self.interval = interval
        config = config if config is not None else QueryBuilderConfig()
        config.auto_fields = False
        super().__init__(
            params=params,
            query=query,
            dataset=dataset,
            selected_columns=selected_columns,
            config=config,
        )

        self.time_column = self.resolve_time_column(interval)
        self.limit = None if limit is None else Limit(limit)

        # This is a timeseries, the implied groupby will always be time
        self.groupby = [self.time_column]

        # If additional groupby is provided it will be used first before time
        if groupby is not None:
            self.groupby.insert(0, groupby)

    def resolve_granularity(self) -> Granularity:
        """Find the largest granularity that is smaller than the interval"""
        for available_granularity in constants.METRICS_GRANULARITIES:
            if available_granularity <= self.interval:
                max_granularity = available_granularity
                break
        else:
            # if we are here the user requested an interval smaller than the smallest granularity available.
            # We'll force the interval to be the smallest granularity (since we don't have data at the requested interval)
            # and return the smallest granularity
            self.interval = constants.METRICS_GRANULARITIES[-1]
            max_granularity = self.interval

        optimal_granularity = optimal_granularity_for_date_range(self.start, self.end)

        # get the minimum granularity between the optimal granularity and the max granularity
        granularity = min(optimal_granularity, max_granularity)

        return Granularity(granularity)

    def resolve_split_granularity(self) -> Tuple[List[Condition], Optional[Granularity]]:
        """Don't do this for timeseries"""
        return [], self.granularity

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
        if self.builder_config.use_metrics_layer:
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
        if self.builder_config.use_metrics_layer or self._on_demand_metric_spec:
            from sentry.snuba.metrics.datasource import get_series
            from sentry.snuba.metrics.mqb_query_transformer import (
                transform_mqb_query_to_metrics_query,
            )

            try:
                with sentry_sdk.start_span(op="metric_layer", description="transform_query"):
                    if self._on_demand_metric_spec:
                        metrics_query = self._get_metrics_query_from_on_demand_spec(
                            spec=self._on_demand_metric_spec, require_time_range=True
                        )
                    elif self.builder_config.use_metrics_layer:
                        snuba_query = self.get_snql_query()[0].query
                        metrics_query = transform_mqb_query_to_metrics_query(
                            snuba_query, self.is_alerts_query
                        )
                with sentry_sdk.start_span(op="metric_layer", description="run_query"):
                    metrics_data = get_series(
                        projects=self.params.projects,
                        metrics_query=metrics_query,
                        use_case_id=UseCaseID.TRANSACTIONS
                        if self.is_performance
                        else UseCaseID.SESSIONS,
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


class TopMetricsQueryBuilder(TimeseriesMetricQueryBuilder):
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
        limit: Optional[int] = 10000,
        config: Optional[QueryBuilderConfig] = None,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        super().__init__(
            dataset=dataset,
            params=params,
            interval=interval,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_columns)),
            limit=limit,
            config=config,
        )

        self.fields: List[str] = selected_columns if selected_columns is not None else []
        self.fields = [self.tag_to_prefixed_map.get(c, c) for c in selected_columns]

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
            resolved_field = self.resolve_column(field)

            values: Set[Any] = set()
            for event in top_events:
                if field not in event:
                    continue

                value = event.get(field)
                # TODO: Handle potential None case
                if value is not None:
                    value = self.resolve_tag_value(str(value))
                values.add(value)

            values_list = list(values)

            if values_list:
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

    def run_query(self, referrer: str, use_cache: bool = False) -> Any:
        queries = self.get_snql_query()
        if queries:
            results = bulk_snql_query(queries, referrer, use_cache)
        else:
            results = []

        time_map: Dict[str, Dict[str, Any]] = defaultdict(dict)
        meta_dict = {}
        for current_result in results:
            # there's multiple groupbys so we need the unique keys
            for row in current_result["data"]:
                result_key = create_result_key(row, self.translated_groupby, {})
                time_alias = row[self.time_alias]
                time_map[f"{time_alias}-{result_key}"].update(row)
            for meta in current_result["meta"]:
                meta_dict[meta["name"]] = meta["type"]

        return {
            "data": list(time_map.values()),
            "meta": [{"name": key, "type": value} for key, value in meta_dict.items()],
        }
