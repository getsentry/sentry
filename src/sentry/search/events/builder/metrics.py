from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

from sentry_sdk import traces
from snuba_sdk import (
    AliasedExpression,
    Column,
    Condition,
    CurriedFunction,
    Entity,
    Flags,
    Function,
    Granularity,
    Limit,
    Op,
    Or,
    Query,
    Request,
)

from sentry.api.event_search import SearchFilter
from sentry.exceptions import IncompatibleMetricsQuery, InvalidSearchQuery
from sentry.search.events import constants, fields
from sentry.search.events.builder.base import BaseQueryBuilder
from sentry.search.events.builder.utils import (
    adjust_datetime_to_granularity,
    optimal_granularity_for_date_range,
)
from sentry.search.events.datasets.base import DatasetConfig
from sentry.search.events.datasets.metrics import MetricsDatasetConfig
from sentry.search.events.filter import ParsedTerms
from sentry.search.events.types import (
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
from sentry.utils.snuba import DATASETS


class MetricsQueryBuilder(BaseQueryBuilder):
    """Build session metrics queries for crash-rate alert subscriptions."""

    requires_organization_condition = True
    organization_id: int
    organization_column = "organization_id"
    default_metric_tags = constants.DEFAULT_METRIC_TAGS
    use_case_id = UseCaseID.SESSIONS

    def __init__(
        self,
        params: ParamsType,
        *,
        dataset: Dataset = Dataset.Metrics,
        granularity: int | None = None,
        time_range_window: int | None = None,
        config: QueryBuilderConfig | None = None,
        **kwargs: Any,
    ):
        if dataset is not Dataset.Metrics:
            raise InvalidSearchQuery("Only session metrics are supported")
        if config is None:
            config = QueryBuilderConfig()
        config.has_metrics = True
        self.distributions: list[CurriedFunction] = []
        self.sets: list[CurriedFunction] = []
        self.counters: list[CurriedFunction] = []
        self.percentiles: list[CurriedFunction] = []
        self.metric_ids: set[int] = set()
        self._indexer_cache: dict[str, int | None] = {}
        self._has_nullable = False
        if granularity is not None:
            self._granularity = granularity
        super().__init__(dataset, params, config=config, **kwargs)
        if self.organization_id is None:
            raise InvalidSearchQuery("Organization id required to create a metrics query")

    def load_config(self) -> DatasetConfig:
        return MetricsDatasetConfig(self)

    def resolve_query(
        self,
        query: str | None = None,
        selected_columns: list[str] | None = None,
        groupby_columns: list[str] | None = None,
        equations: list[str] | None = None,
        orderby: list[str] | str | None = None,
    ) -> None:
        with traces.start_span(
            name="resolve_time_conditions", attributes={"sentry.op": "QueryBuilder"}
        ):
            # Has to be done early, since other conditions depend on start and end
            self.resolve_time_conditions()
        with traces.start_span(
            name="resolve_granularity", attributes={"sentry.op": "QueryBuilder"}
        ):
            # Needs to happen before params and after time conditions since granularity can change start&end
            self.granularity = self.resolve_granularity()
            if self.start is not None:
                self.start = adjust_datetime_to_granularity(
                    self.start, self.granularity.granularity
                )

        with traces.start_span(name="resolve_conditions", attributes={"sentry.op": "QueryBuilder"}):
            self.where, self.having = self.resolve_conditions(query)
        with traces.start_span(name="resolve_params", attributes={"sentry.op": "QueryBuilder"}):
            # params depends on parse_query, and conditions being resolved first since there may be projects
            # in conditions
            self.where += self.resolve_params()
        with traces.start_span(name="resolve_columns", attributes={"sentry.op": "QueryBuilder"}):
            self.columns = self.resolve_select(selected_columns, equations)
        with traces.start_span(name="resolve_orderby", attributes={"sentry.op": "QueryBuilder"}):
            self.orderby = self.resolve_orderby(orderby)
        with traces.start_span(name="resolve_groupby", attributes={"sentry.op": "QueryBuilder"}):
            self.groupby = self.resolve_groupby(groupby_columns)
        if len(self.metric_ids) > 0:
            self.where.append(
                # Metric id is intentionally sorted, so we create consistent queries here both for testing & caching.
                Condition(Column("metric_id"), Op.IN, sorted(self.metric_ids))
            )

    def resolve_column_name(self, col: str) -> str:
        if col.startswith("tags["):
            tag_match = constants.TAG_KEY_RE.search(col)
            col = tag_match.group("tag") if tag_match else col

        if col in DATASETS[self.dataset]:
            return str(DATASETS[self.dataset][col])
        tag_id = self.resolve_tag_key(col)
        if tag_id is None:
            raise InvalidSearchQuery(f"Unknown field: {col}")
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

    def resolve_having(self, parsed_terms: ParsedTerms) -> list[WhereType]:
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

    def resolve_limit(self, limit: int | None) -> Limit:
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
        snql_function: fields.SnQLFunction,
        arguments: Mapping[str, NormalizedArg],
        alias: str,
        resolve_only: bool,
    ) -> SelectType | None:
        if not isinstance(snql_function, fields.MetricsFunction):
            return super().resolve_snql_function(snql_function, arguments, alias, resolve_only)
        # If the metric_id is 0 that means this is a function that won't return but we don't want to error the query
        nullable = arguments.get("metric_id") == 0
        if nullable:
            self._has_nullable = True

        if snql_function.snql_distribution is not None:
            resolved_function = snql_function.snql_distribution(arguments, alias)
            if not resolve_only:
                if not nullable:
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
                if not nullable:
                    self.sets.append(resolved_function)
                # Still add to aggregates so groupby is correct
                self.aggregates.append(resolved_function)
            return resolved_function
        if snql_function.snql_counter is not None:
            resolved_function = snql_function.snql_counter(arguments, alias)
            if not resolve_only:
                if not nullable:
                    self.counters.append(resolved_function)
                # Still add to aggregates so groupby is correct
                self.aggregates.append(resolved_function)
            return resolved_function
        return None

    def resolve_metric_index(self, value: str) -> int | None:
        """Layer on top of the metric indexer so we'll only hit it at most once per value"""
        if value not in self._indexer_cache:
            result = indexer.resolve(
                self.use_case_id,
                self.organization_id,
                value,
            )
            self._indexer_cache[value] = result

        return self._indexer_cache[value]

    def resolve_tag_value(self, value: str) -> int | None:
        return self.resolve_metric_index(value)

    def resolve_tag_key(self, value: str) -> int | None:
        if (
            value in self.default_metric_tags
            or self.builder_config.skip_field_validation_for_entity_subscription_deletion
        ):
            return self.resolve_metric_index(value)
        raise IncompatibleMetricsQuery(f"{value} is not a tag in the metrics dataset")

    def default_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
        name = search_filter.key.name
        operator = search_filter.operator
        value = search_filter.value.value

        # Handle checks for existence
        if search_filter.operator in ("=", "!=") and search_filter.value.value == "":
            return Condition(
                Function("has", [Column("tags.key"), self.resolve_metric_index(name)]),
                Op.EQ if search_filter.operator == "!=" else Op.NEQ,
                1,
            )

        if name in ["organization_id", "org_id"]:
            raise IncompatibleMetricsQuery(f"{name} isn't compatible with metrics queries")
        lhs = self.resolve_column(name)
        # If this is an aliasedexpression, we don't need the alias here, just the expression
        if isinstance(lhs, AliasedExpression):
            lhs = lhs.exp

        # resolve_column will try to resolve this name with indexer, and if its a tag the Column will be tags[1]
        is_tag = isinstance(lhs, Column) and lhs.subscriptable == "tags"
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
            value = int(value.timestamp()) * 1000

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

    def _resolve_environment_filter_value(self, value: str) -> int | str:
        value_id: int | str | None = self.resolve_tag_value(f"{value}")
        if value_id is None:
            raise IncompatibleMetricsQuery(f"Environment: {value} was not found")

        return value_id

    def _environment_filter_converter(self, search_filter: SearchFilter) -> WhereType | None:
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
                # Missing integer-indexed tags resolve to zero.
                values.append(0)
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

    def get_snql_query(self) -> Request:
        """
        This method returns the normal snql of the query being built for execution.
        """
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

    def _get_base_query_framework(self) -> dict[str, QueryFramework]:
        query_framework = {
            "distribution": QueryFramework(
                orderby=[],
                having=[],
                functions=self.distributions,
                entity=Entity("metrics_distributions", sample=self.sample_rate),
            ),
            "counter": QueryFramework(
                orderby=[],
                having=[],
                functions=self.counters,
                entity=Entity("metrics_counters", sample=self.sample_rate),
            ),
            "set": QueryFramework(
                orderby=[],
                having=[],
                functions=self.sets,
                entity=Entity("metrics_sets", sample=self.sample_rate),
            ),
            # Percentiles are a part of distributions but they're expensive, treat them as their own entity so we'll run
            # a query with the cheap distributions first then only get page_size quantiles
            "percentiles": QueryFramework(
                orderby=[],
                having=[],
                functions=self.percentiles,
                entity=Entity("metrics_distributions", sample=self.sample_rate),
            ),
        }
        return query_framework

    def _create_query_framework(self) -> tuple[str, dict[str, QueryFramework]]:
        query_framework = self._get_base_query_framework()
        primary = None
        # if orderby spans more than one table, the query isn't possible with metrics
        for orderby in self.orderby:
            for entity, framework in query_framework.items():
                if orderby.exp in framework.functions:
                    framework.orderby.append(orderby)
                    if primary not in [None, entity]:
                        raise IncompatibleMetricsQuery("Can't order across tables")
                    primary = entity
                    break
            else:
                # An orderby that isn't on a function add it to all of them
                for framework in query_framework.values():
                    framework.orderby.append(orderby)

        having_entity: str | None = None
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


class AlertMetricsQueryBuilder(MetricsQueryBuilder):
    def __init__(self, *args: Any, granularity: int, time_range_window: int, **kwargs: Any):
        self._granularity = granularity
        super().__init__(*args, **kwargs)

    def resolve_limit(self, limit: int | None) -> Limit | None:
        return None

    def resolve_granularity(self) -> Granularity:
        return Granularity(self._granularity)
