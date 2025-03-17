from __future__ import annotations

import dataclasses
import functools
import itertools
from collections.abc import Mapping, Sequence, Set
from copy import deepcopy
from datetime import datetime
from typing import Any

from snuba_sdk import (
    Column,
    Direction,
    Entity,
    Function,
    Granularity,
    Limit,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.conditions import Condition, ConditionGroup, Op, Or
from snuba_sdk.entity import get_required_time_column
from snuba_sdk.legacy import is_condition, parse_condition
from snuba_sdk.query import SelectableExpression

from sentry.constants import DataCategory
from sentry.ingest.inbound_filters import FILTER_STAT_KEYS_TO_VALUES
from sentry.issues.query import manual_group_on_time_aggregation
from sentry.snuba.dataset import Dataset
from sentry.tsdb.base import BaseTSDB, TSDBItem, TSDBKey, TSDBModel
from sentry.utils import outcomes, snuba
from sentry.utils.dates import to_datetime
from sentry.utils.snuba import (
    get_snuba_translators,
    infer_project_ids_from_related_models,
    nest_groups,
    raw_snql_query,
)


@dataclasses.dataclass
class SnubaModelQuerySettings:
    # The dataset in Snuba that we want to query
    dataset: Dataset

    # The column in Snuba that we want to put in the group by statement
    groupby: str
    # The column in Snuba that we want to run the aggregate function on
    aggregate: str | None
    # Any additional model specific conditions we want to pass in the query
    conditions: Sequence[Any]
    # The projected columns to select in the underlying dataset
    selected_columns: Sequence[Any] | None = None


# combine DEFAULT, ERROR, and SECURITY as errors. We are now recording outcome by
# category, and these TSDB models and where they're used assume only errors.
# see relay: py/sentry_relay/consts.py and relay-cabi/include/relay.h
OUTCOMES_CATEGORY_CONDITION = [
    "category",
    "IN",
    DataCategory.error_categories(),
]

# We include a subset of outcome results as to not show client-discards
# and invalid results as those are not shown in org-stats and we want
# data to line up.
TOTAL_RECEIVED_OUTCOMES = [
    outcomes.Outcome.ACCEPTED,
    outcomes.Outcome.FILTERED,
    outcomes.Outcome.RATE_LIMITED,
]


class SnubaTSDB(BaseTSDB):
    """
    A time series query interface to Snuba

    Write methods are not supported, as the raw data from which we generate our
    time series is assumed to already exist in snuba.

    Read methods are supported only for models based on group/event data and
    will return empty results for unsupported models.
    """

    # ``project_filter_model_query_settings`` and ``outcomes_partial_query_settings`` are all the TSDB models for
    # outcomes
    project_filter_model_query_settings = {
        model: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "project_id",
            "quantity",
            [
                ["reason", "=", reason],
                ["outcome", "IN", TOTAL_RECEIVED_OUTCOMES],
                OUTCOMES_CATEGORY_CONDITION,
            ],
        )
        for reason, model in FILTER_STAT_KEYS_TO_VALUES.items()
    }

    outcomes_partial_query_settings = {
        TSDBModel.organization_total_received: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "org_id",
            "quantity",
            [
                ["outcome", "IN", TOTAL_RECEIVED_OUTCOMES],
                OUTCOMES_CATEGORY_CONDITION,
            ],
        ),
        TSDBModel.organization_total_rejected: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "org_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.organization_total_blacklisted: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "org_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.FILTERED], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.project_total_received: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "project_id",
            "quantity",
            [["outcome", "IN", TOTAL_RECEIVED_OUTCOMES], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.project_total_rejected: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "project_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.project_total_blacklisted: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "project_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.FILTERED], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.key_total_received: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "key_id",
            "quantity",
            [["outcome", "IN", TOTAL_RECEIVED_OUTCOMES], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.key_total_rejected: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "key_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.RATE_LIMITED], OUTCOMES_CATEGORY_CONDITION],
        ),
        TSDBModel.key_total_blacklisted: SnubaModelQuerySettings(
            Dataset.Outcomes,
            "key_id",
            "quantity",
            [["outcome", "=", outcomes.Outcome.FILTERED], OUTCOMES_CATEGORY_CONDITION],
        ),
    }

    # ``non_outcomes_query_settings`` are all the query settings for non outcomes based TSDB models.
    # Single tenant reads Snuba for these models, and writes to DummyTSDB. It reads and writes to Redis for all the
    # other models.
    # these query settings should use SnQL style parameters instead of the legacy format
    non_outcomes_snql_query_settings = {
        TSDBModel.project: SnubaModelQuerySettings(Dataset.Events, "project_id", None, []),
        TSDBModel.group: SnubaModelQuerySettings(Dataset.Events, "group_id", None, []),
        TSDBModel.release: SnubaModelQuerySettings(Dataset.Events, "release", None, []),
        TSDBModel.users_affected_by_group: SnubaModelQuerySettings(
            Dataset.Events, "group_id", "tags[sentry:user]", []
        ),
        TSDBModel.users_affected_by_project: SnubaModelQuerySettings(
            Dataset.Events, "project_id", "user", []
        ),
        TSDBModel.frequent_environments_by_group: SnubaModelQuerySettings(
            Dataset.Events, "group_id", "environment", []
        ),
        TSDBModel.frequent_releases_by_group: SnubaModelQuerySettings(
            Dataset.Events, "group_id", "release", []
        ),
        TSDBModel.frequent_issues_by_project: SnubaModelQuerySettings(
            Dataset.Events, "project_id", "group_id", []
        ),
        TSDBModel.group_generic: SnubaModelQuerySettings(
            Dataset.IssuePlatform,
            "group_id",
            None,
            [],
            None,
        ),
        TSDBModel.users_affected_by_generic_group: SnubaModelQuerySettings(
            Dataset.IssuePlatform,
            "group_id",
            "tags[sentry:user]",
            [],
            None,
        ),
    }

    # ``model_query_settings`` is a translation of TSDB models into required settings for querying snuba
    model_query_settings = dict(
        itertools.chain(
            project_filter_model_query_settings.items(),
            outcomes_partial_query_settings.items(),
            non_outcomes_snql_query_settings.items(),
        )
    )

    def __init__(self, **options):
        super().__init__(**options)

    def __manual_group_on_time_aggregation(self, rollup, time_column_alias) -> list[Any]:
        """
        Explicitly builds an aggregation expression in-place of using a `TimeSeriesProcessor` on the snuba entity.
        Older tables and queries that target that table had syntactic sugar on the `time` column and would apply
        additional processing to re-write the query. For entities/models that don't have that special processing,
        we need to manually insert the equivalent query to get the same result.
        """

        def rollup_agg(rollup_granularity, alias):
            if rollup_granularity == 60:
                return ["toUnixTimestamp", [["toStartOfMinute", "timestamp"]], alias]
            elif rollup_granularity == 3600:
                return ["toUnixTimestamp", [["toStartOfHour", "timestamp"]], alias]
            elif rollup_granularity == 3600 * 24:
                return [
                    "toUnixTimestamp",
                    [["toDateTime", [["toDate", "timestamp"]]]],
                    time_column_alias,
                ]
            else:
                return None

        # if we don't have an explicit function mapped to this rollup, we have to calculate it on the fly
        # multiply(intDiv(toUInt32(toUnixTimestamp(timestamp)), granularity)))
        synthetic_rollup = [
            "multiply",
            [["intDiv", [["toUInt32", [["toUnixTimestamp", "timestamp"]]], rollup]], rollup],
            time_column_alias,
        ]

        known_rollups = rollup_agg(rollup, time_column_alias)

        return known_rollups if known_rollups else synthetic_rollup

    def get_data(
        self,
        model,
        keys,
        start,
        end,
        rollup=None,
        environment_ids=None,
        aggregation="count()",
        group_on_model=True,
        group_on_time=False,
        conditions=None,
        use_cache=False,
        jitter_value=None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ):
        if model in self.non_outcomes_snql_query_settings:
            # no way around having to explicitly map legacy condition format to SnQL since this function
            # is used everywhere that expects `conditions` to be legacy format
            parsed_conditions = []
            for cond in conditions or ():
                if not is_condition(cond):
                    or_conditions = []
                    for or_cond in cond:
                        or_conditions.append(parse_condition(or_cond))

                    if len(or_conditions) > 1:
                        parsed_conditions.append(Or(or_conditions))
                    else:
                        parsed_conditions.extend(or_conditions)
                else:
                    parsed_conditions.append(parse_condition(cond))

            return self.__get_data_snql(
                model,
                keys,
                start,
                end,
                rollup,
                environment_ids,
                "count" if aggregation == "count()" else aggregation,
                group_on_model,
                group_on_time,
                parsed_conditions,
                use_cache,
                jitter_value,
                manual_group_on_time=(
                    model in (TSDBModel.group_generic, TSDBModel.users_affected_by_generic_group)
                ),
                is_grouprelease=(model == TSDBModel.frequent_releases_by_group),
                tenant_ids=tenant_ids,
                referrer_suffix=referrer_suffix,
            )
        else:
            return self.__get_data_legacy(
                model,
                keys,
                start,
                end,
                rollup,
                environment_ids,
                aggregation,
                group_on_model,
                group_on_time,
                conditions,
                use_cache,
                jitter_value,
                tenant_ids,
                referrer_suffix,
            )

    def __get_data_snql(
        self,
        model: TSDBModel,
        keys: Sequence | Set | Mapping,
        start: datetime,
        end: datetime | None,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        aggregation: str = "count",
        group_on_model: bool = True,
        group_on_time: bool = False,
        conditions: ConditionGroup | None = None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        manual_group_on_time: bool = False,
        is_grouprelease: bool = False,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ):
        """
        Similar to __get_data_legacy but uses the SnQL format. For future additions, prefer using this impl over
        the legacy format.
        """
        model_query_settings = self.model_query_settings.get(model)

        if model_query_settings is None:
            raise Exception(f"Unsupported TSDBModel: {model.name}")

        model_group = model_query_settings.groupby
        model_aggregate = model_query_settings.aggregate
        model_dataset = model_query_settings.dataset

        columns = (model_query_settings.groupby, model_query_settings.aggregate)
        keys_map_tmp = dict(zip(columns, self.flatten_keys(keys)))
        keys_map = {k: v for k, v in keys_map_tmp.items() if k is not None and v is not None}
        if environment_ids is not None:
            keys_map["environment"] = environment_ids

        # For historical compatibility with bucket-counted TSDB implementations
        # we grab the original bucketed series and add the rollup time to the
        # timestamp of the last bucket to get the end time.
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        # If jitter_value is provided then we use it to offset the buckets we round start/end to by
        # up  to `rollup` seconds.
        series = self._add_jitter_to_series(series, start, rollup, jitter_value)

        groupby = []
        if group_on_model and model_group is not None:
            groupby.append(model_group)
        if group_on_time:
            groupby.append("time")
        if aggregation == "count" and model_aggregate is not None:
            # Special case, because count has different semantics, we change:
            # `COUNT(model_aggregate)` to `COUNT() GROUP BY model_aggregate`
            groupby.append(model_aggregate)
            model_aggregate = None

        aggregated_as = "aggregate"
        aggregations: list[SelectableExpression] = [
            Function(
                aggregation,
                [Column(model_aggregate)] if model_aggregate else [],
                aggregated_as,
            )
        ]

        if group_on_time and manual_group_on_time:
            aggregations.append(manual_group_on_time_aggregation(rollup, "time"))

        if keys:
            start = to_datetime(series[0])
            end = to_datetime(series[-1] + rollup)
            limit = min(10000, int(len(keys) * ((end - start).total_seconds() / rollup)))

            # build up order by
            orderby: list[OrderBy] = []
            if group_on_time:
                orderby.append(OrderBy(Column("time"), Direction.DESC))
            if group_on_model and model_group is not None:
                orderby.append(OrderBy(Column(model_group), Direction.ASC))

            # build up where conditions
            conditions = list(conditions) if conditions is not None else []
            if model_query_settings.conditions is not None:
                conditions += model_query_settings.conditions

            project_ids = infer_project_ids_from_related_models(keys_map)
            keys_map["project_id"] = project_ids
            forward, reverse = get_snuba_translators(keys_map, is_grouprelease)

            # resolve filter_key values to the right values environment.id -> environment.name, etc.
            mapped_filter_conditions = []
            for col, f_keys in forward(deepcopy(keys_map)).items():
                if f_keys:
                    if len(f_keys) == 1 and None in f_keys:
                        mapped_filter_conditions.append(Condition(Column(col), Op.IS_NULL))
                    else:
                        mapped_filter_conditions.append(Condition(Column(col), Op.IN, f_keys))

            where_conds = conditions + mapped_filter_conditions
            if manual_group_on_time:
                where_conds += [
                    Condition(Column("timestamp"), Op.GTE, start),
                    Condition(Column("timestamp"), Op.LT, end),
                ]
            else:
                time_column = get_required_time_column(model_dataset.value)
                if time_column:
                    where_conds += [
                        Condition(Column(time_column), Op.GTE, start),
                        Condition(Column(time_column), Op.LT, end),
                    ]

            snql_request = Request(
                dataset=model_dataset.value,
                app_id="tsdb.get_data",
                query=Query(
                    match=Entity(model_dataset.value),
                    select=list(
                        itertools.chain((model_query_settings.selected_columns or []), aggregations)
                    ),
                    where=where_conds,
                    groupby=[Column(g) for g in groupby] if groupby else None,
                    orderby=orderby,
                    granularity=Granularity(rollup),
                    limit=Limit(limit),
                ),
                tenant_ids=tenant_ids or dict(),
            )
            referrer = f"tsdb-modelid:{model.value}"

            if referrer_suffix:
                referrer += f".{referrer_suffix}"

            query_result = raw_snql_query(snql_request, referrer, use_cache=use_cache)
            if manual_group_on_time:
                translated_results = {"data": query_result["data"]}
            else:
                translated_results = {"data": [reverse(d) for d in query_result["data"]]}
            result = nest_groups(translated_results["data"], groupby, [aggregated_as])

        else:
            # don't bother querying snuba since we probably won't have the proper filter conditions to return
            # reasonable data (invalid query)
            result = {}

        if group_on_time:
            keys_map["time"] = series

        self.zerofill(result, groupby, keys_map)
        self.trim(result, groupby, keys)

        if group_on_time and manual_group_on_time:
            self.unnest(result, aggregated_as)
            return result
        else:
            return result

    def __get_data_legacy(
        self,
        model,
        keys,
        start,
        end,
        rollup=None,
        environment_ids=None,
        aggregation="count()",
        group_on_model=True,
        group_on_time=False,
        conditions=None,
        use_cache=False,
        jitter_value=None,
        tenant_ids=None,
        referrer_suffix=None,
    ):
        """
        Normalizes all the TSDB parameters and sends a query to snuba.

        `group_on_time`: whether to add a GROUP BY clause on the 'time' field.
        `group_on_model`: whether to add a GROUP BY clause on the primary model.
        """
        # XXX: to counteract the hack in project_key_stats.py
        if model in [
            TSDBModel.key_total_received,
            TSDBModel.key_total_blacklisted,
            TSDBModel.key_total_rejected,
        ]:
            keys = list(set(map(lambda x: int(x), keys)))

        model_requires_manual_group_on_time = model in (
            TSDBModel.group_generic,
            TSDBModel.users_affected_by_generic_group,
        )
        group_on_time_column_alias = "grouped_time"

        model_query_settings = self.model_query_settings.get(model)

        if model_query_settings is None:
            raise Exception(f"Unsupported TSDBModel: {model.name}")

        model_group = model_query_settings.groupby
        model_aggregate = model_query_settings.aggregate

        # 10s is the only rollup under an hour that we support
        if rollup == 10 and model_query_settings.dataset == Dataset.Outcomes:
            model_dataset = Dataset.OutcomesRaw
        else:
            model_dataset = model_query_settings.dataset

        groupby = []
        if group_on_model and model_group is not None:
            groupby.append(model_group)
        if group_on_time:
            if not model_requires_manual_group_on_time:
                groupby.append("time")
            else:
                groupby.append(group_on_time_column_alias)
        if aggregation == "count()" and model_aggregate is not None:
            # Special case, because count has different semantics, we change:
            # `COUNT(model_aggregate)` to `COUNT() GROUP BY model_aggregate`
            groupby.append(model_aggregate)
            model_aggregate = None

        columns = (model_query_settings.groupby, model_query_settings.aggregate)
        keys_map = dict(zip(columns, self.flatten_keys(keys)))
        keys_map = {k: v for k, v in keys_map.items() if k is not None and v is not None}
        if environment_ids is not None:
            keys_map["environment"] = environment_ids

        aggregated_as = "aggregate"
        aggregations = [[aggregation, model_aggregate, aggregated_as]]

        # For historical compatibility with bucket-counted TSDB implementations
        # we grab the original bucketed series and add the rollup time to the
        # timestamp of the last bucket to get the end time.
        rollup, series = self.get_optimal_rollup_series(start, end, rollup)

        if group_on_time and model_requires_manual_group_on_time:
            aggregations.append(
                self.__manual_group_on_time_aggregation(rollup, group_on_time_column_alias)
            )

        # If jitter_value is provided then we use it to offset the buckets we round start/end to by
        # up  to `rollup` seconds.
        series = self._add_jitter_to_series(series, start, rollup, jitter_value)

        start = to_datetime(series[0])
        end = to_datetime(series[-1] + rollup)
        limit = min(10000, int(len(keys) * ((end - start).total_seconds() / rollup)))

        conditions = conditions if conditions is not None else []
        if model_query_settings.conditions is not None:
            conditions += deepcopy(model_query_settings.conditions)
            # copy because we modify the conditions in snuba.query

        orderby = []
        if group_on_time:
            if not model_requires_manual_group_on_time:
                orderby.append("-time")
            else:
                orderby.append(f"-{group_on_time_column_alias}")
        if group_on_model and model_group is not None:
            orderby.append(model_group)

        if keys:
            referrer = f"tsdb-modelid:{model.value}"

            if referrer_suffix:
                referrer += f".{referrer_suffix}"

            query_func_without_selected_columns = functools.partial(
                snuba.query,
                dataset=model_dataset,
                start=start,
                end=end,
                groupby=groupby,
                conditions=conditions,
                filter_keys=keys_map,
                aggregations=aggregations,
                rollup=rollup,
                limit=limit,
                orderby=orderby,
                referrer=referrer,
                is_grouprelease=(model == TSDBModel.frequent_releases_by_group),
                use_cache=use_cache,
                tenant_ids=tenant_ids or dict(),
            )
            if model_query_settings.selected_columns:
                result = query_func_without_selected_columns(
                    selected_columns=model_query_settings.selected_columns
                )
                self.unnest(result, aggregated_as)
            else:
                result = query_func_without_selected_columns()
        else:
            result = {}

        if group_on_time:
            if not model_requires_manual_group_on_time:
                keys_map["time"] = series
            else:
                keys_map[group_on_time_column_alias] = series

        self.zerofill(result, groupby, keys_map)
        self.trim(result, groupby, keys)

        if group_on_time and model_requires_manual_group_on_time:
            # unroll aggregated data
            self.unnest(result, aggregated_as)
            return result
        else:
            return result

    def zerofill(self, result, groups, flat_keys):
        """
        Fills in missing keys in the nested result with zeroes.
        `result` is the nested result
        `groups` is the order in which the result is nested, eg: ['project', 'time']
        `flat_keys` is a map from groups to lists of required keys for that group.
                    eg: {'project': [1,2]}
        """
        if len(groups) > 0:
            group, subgroups = groups[0], groups[1:]
            # Zerofill missing keys
            for k in flat_keys[group]:
                if k not in result:
                    result[k] = 0 if len(groups) == 1 else {}

            if subgroups:
                for v in result.values():
                    self.zerofill(v, subgroups, flat_keys)

    def trim(self, result, groups, keys):
        """
        Similar to zerofill, but removes keys that should not exist.
        Uses the non-flattened version of keys, so that different sets
        of keys can exist in different branches at the same nesting level.
        """
        if len(groups) > 0:
            group, subgroups = groups[0], groups[1:]
            if isinstance(result, dict):
                for rk in list(result.keys()):
                    if group == "time":  # Skip over time group
                        self.trim(result[rk], subgroups, keys)
                    elif rk in keys:
                        if isinstance(keys, dict):
                            self.trim(result[rk], subgroups, keys[rk])
                    else:
                        del result[rk]

    def unnest(self, result, aggregated_as):
        """
        Unnests the aggregated value in results and places it one level higher to conform to the
        proper result format
        convert:
        {
          "groupby[0]:value1" : {
            "groupby[1]:value1" : {
              "groupby[2]:value1" : {
                "groupby[0]": groupby[0]:value1
                "groupby[1]": groupby[1]:value1
                "aggregation_as": aggregated_value
              }
            }
          },
        },
        to:
        {
          "groupby[0]:value1": {
            "groupby[1]:value1" : {
              "groupby[2]:value1" : aggregated_value
            }
          },
        }, ...
        """
        from collections.abc import MutableMapping

        if isinstance(result, MutableMapping):
            for key, val in result.items():
                if isinstance(val, MutableMapping):
                    if val.get(aggregated_as):
                        result[key] = val.get(aggregated_as)
                    else:
                        self.unnest(val, aggregated_as)

    def get_range(
        self,
        model: TSDBModel,
        keys: Sequence[TSDBKey],
        start: datetime,
        end: datetime,
        rollup: int | None = None,
        environment_ids: Sequence[int] | None = None,
        conditions=None,
        use_cache: bool = False,
        jitter_value: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer_suffix: str | None = None,
    ) -> dict[TSDBKey, list[tuple[int, int]]]:
        model_query_settings = self.model_query_settings.get(model)
        assert model_query_settings is not None, f"Unsupported TSDBModel: {model.name}"

        if model_query_settings.dataset == Dataset.Outcomes:
            aggregate_function = "sum"
        else:
            aggregate_function = "count()"

        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            environment_ids,
            aggregation=aggregate_function,
            group_on_time=True,
            conditions=conditions,
            use_cache=use_cache,
            jitter_value=jitter_value,
            tenant_ids=tenant_ids,
            referrer_suffix=referrer_suffix,
        )
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_series(
        self,
        model,
        keys: Sequence[int],
        start,
        end=None,
        rollup=None,
        environment_id=None,
        tenant_ids=None,
    ):
        result = self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="uniq",
            group_on_time=True,
            tenant_ids=tenant_ids,
        )
        # convert
        #    {group:{timestamp:count, ...}}
        # into
        #    {group: [(timestamp, count), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def get_distinct_counts_totals(
        self,
        model,
        keys: Sequence[int],
        start,
        end=None,
        rollup=None,
        environment_id=None,
        use_cache=False,
        jitter_value=None,
        tenant_ids=None,
        referrer_suffix=None,
        conditions=None,
    ):
        return self.get_data(
            model,
            keys,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="uniq",
            use_cache=use_cache,
            jitter_value=jitter_value,
            tenant_ids=tenant_ids,
            referrer_suffix=referrer_suffix,
            conditions=conditions,
        )

    def get_frequency_series(
        self,
        model: TSDBModel,
        items: Mapping[TSDBKey, Sequence[TSDBItem]],
        start: datetime,
        end: datetime | None = None,
        rollup: int | None = None,
        environment_id: int | None = None,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> dict[TSDBKey, list[tuple[float, dict[TSDBItem, float]]]]:
        result = self.get_data(
            model,
            items,
            start,
            end,
            rollup,
            [environment_id] if environment_id is not None else None,
            aggregation="count()",
            group_on_time=True,
            tenant_ids=tenant_ids,
        )
        # convert
        #    {group:{timestamp:{agg:count}}}
        # into
        #    {group: [(timestamp, {agg: count, ...}), ...]}
        return {k: sorted(result[k].items()) for k in result}

    def flatten_keys(self, items: Mapping | Sequence | Set) -> tuple[list, Sequence | None]:
        """
        Returns a normalized set of keys based on the various formats accepted
        by TSDB methods. The input is either just a plain list of keys for the
        top level or a `{level1_key: [level2_key, ...]}` dictionary->list map.
        The output is a 2-tuple of ([level_1_keys], [all_level_2_keys])
        """
        if isinstance(items, Mapping):
            return (
                list(items.keys()),
                list(set.union(*(set(v) for v in items.values())) if items else []),
            )
        elif isinstance(items, (Sequence, Set)):
            return (list(items), None)
        else:
            raise ValueError("Unsupported type: %s" % (type(items)))
