from collections import defaultdict
from typing import Any, Dict, List, Optional, Set

from snuba_sdk import AliasedExpression, And, Condition, CurriedFunction, Op, Or

from sentry.search.events.builder import MetricsQueryBuilder, TimeseriesMetricQueryBuilder
from sentry.search.events.types import ParamsType, WhereType
from sentry.snuba.dataset import Dataset
from sentry.snuba.discover import create_result_key
from sentry.utils.snuba import bulk_snql_query


class SpansMetricsQueryBuilder(MetricsQueryBuilder):
    requires_organization_condition = True
    spans_metrics_builder = True

    def get_field_type(self, field: str) -> Optional[str]:
        if field in self.meta_resolver_map:
            return self.meta_resolver_map[field]
        if field in ["span.duration", "span.exclusive_time"]:
            return "duration"

        return None


class TimeseriesSpansMetricsQueryBuilder(SpansMetricsQueryBuilder, TimeseriesMetricQueryBuilder):
    pass


class TopSpansMetricsQueryBuilder(TimeseriesSpansMetricsQueryBuilder):
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
        functions_acl: Optional[List[str]] = None,
        limit: Optional[int] = 10000,
        skip_tag_resolution: bool = False,
    ):
        selected_columns = [] if selected_columns is None else selected_columns
        timeseries_columns = [] if timeseries_columns is None else timeseries_columns
        super().__init__(
            dataset=dataset,
            params=params,
            interval=interval,
            query=query,
            selected_columns=list(set(selected_columns + timeseries_columns)),
            functions_acl=functions_acl,
            limit=limit,
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
