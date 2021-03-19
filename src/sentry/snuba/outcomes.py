from typing import Any, Dict, List, Optional, Tuple, Union
from django.http import QueryDict
from sentry.utils.snuba import raw_query
from .dataset import Dataset
from sentry_relay import DataCategory

from sentry.snuba.sessions_v2 import (
    get_constrained_date_range,
    massage_sessions_result,
    SimpleGroupBy,
)
from sentry.utils.outcomes import Outcome
from datetime import datetime
from sentry.search.utils import InvalidQuery


"""
The new Outcomes API defines a "metrics"-like interface which is can be used in
a similar way to "sessions" and "disover"
# "Metrics"

We have 2 "metrics" that we can query:

- `quantity` (counter): The relevant stat based on category:
        standard event: # of outcomes
        session: number of events within the session
        attachment: quantity in bytes of attachments
- `times_seen` (counter): The number of outcomes that occurred --
        differs from quantity in that:
            it would count # of attachments, and sessions
            if we ever aggregate multiple events into one outcome,
            this would be used to get the number of outcomes

# "Operations" on metrics

Depending on the metric *type*, we can query different things:

- `counter`: Can only be accessed via the `sum` function.

# Tags / Grouping

The Outcome data can be grouped by a set of tags, which can only appear in the
`groupBy` of the query.

- `project`
- `outcome`
- `reason`
- `category`
```
"""


class QuantityField:
    def get_snuba_columns(self, raw_groupby: List[str]) -> List[str]:
        return ["quantity"]

    def extract_from_row(
        self, row: Dict[str, Union[Any, int]], group: Optional[Dict[str, Any]] = None
    ) -> int:
        if row is None:
            return 0
        return row["quantity"]

    # def unit_value(self, row, group):
    #     if row is None:
    #         return
    #     return

    def aggregation(self, dataset: Dataset) -> List[str]:
        return ["sum", "quantity", "quantity"]


class TimesSeenField:
    def get_snuba_columns(self, raw_groupby: List[str]) -> List[str]:
        return ["times_seen"]

    def extract_from_row(
        self, row: Dict[str, Union[Any, int]], group: Optional[Dict[str, Any]] = None
    ) -> int:
        if row is None:
            return 0
        return row["times_seen"]

    # def unit_value(self, row, group):
    #     return "count"

    def aggregation(self, dataset: Dataset) -> List[str]:
        if dataset == Dataset.Outcomes:
            return ["sum", "times_seen", "times_seen"]
        else:
            # rawoutcomes doesnt have times_seen, do a count instead
            return ["count()", "", "times_seen"]


class CategoryDimension(SimpleGroupBy):
    def resolve_filter(self, raw_filter: List[str]) -> List[DataCategory]:
        resolved_categories = set()
        for category in raw_filter:
            if DataCategory.parse(category) == DataCategory.ERROR:
                resolved_categories.update(DataCategory.error_categories())
            else:
                resolved_categories.add(DataCategory.parse(category))
        if DataCategory.ATTACHMENT in resolved_categories and len(resolved_categories) > 1:
            raise InvalidQuery("if filtering by attachment no other category may be present")
        return list(resolved_categories)

    def map_row(self, row: Dict[str, Any]) -> None:
        if "category" in row:
            category = (
                DataCategory.ERROR
                if row["category"] in DataCategory.error_categories()
                else DataCategory(row["category"])
            )
            row["category"] = category.api_name()


class OutcomeDimension(SimpleGroupBy):
    def resolve_filter(self, raw_filter: List[str]) -> List[Outcome]:
        return [Outcome.parse(o) for o in raw_filter]

    def map_row(self, row: Dict[str, Any]) -> None:
        if "outcome" in row:
            row["outcome"] = Outcome(row["outcome"]).api_name()


class ReasonDimension(SimpleGroupBy):
    def resolve_filter(self, raw_filter: List[str]) -> List[str]:
        return [
            "smart_rate_limit" if reason == "spike_protection" else reason for reason in raw_filter
        ]

    def map_row(self, row: Dict[str, Any]) -> None:
        if "reason" in row:
            row["reason"] = (
                "spike_protection" if row["reason"] == "smart_rate_limit" else row["reason"]
            )  # return spike protection to be consistent with naming in other places


class InvalidField(Exception):  # TODO: move to common
    pass


COLUMN_MAP = {
    "sum(quantity)": QuantityField(),
    "sum(times_seen)": TimesSeenField(),
}

DIMENSION_MAP = {
    "project": SimpleGroupBy("project_id", "project"),
    "key": SimpleGroupBy("key_id"),
    "outcome": OutcomeDimension("outcome"),
    "category": CategoryDimension("category"),
    "reason": ReasonDimension("reason"),
}

TS_COL = "time"


def get_filter(
    query: Any, params: Dict[Any, Any]
) -> Dict[str, Union[List[List[Any]], Dict[str, Any]]]:
    filter_keys = {}
    conditions = []

    for filter_name in ["category", "outcome", "reason"]:
        raw_filter = query.getlist(filter_name, [])
        resolved_filter = DIMENSION_MAP[filter_name].resolve_filter(raw_filter)
        if len(resolved_filter) > 0:
            conditions.append([filter_name, "IN", resolved_filter])

    if "project_id" in params:
        filter_keys["project_id"] = params["project_id"]
    if "organization" in params:
        filter_keys["organization_id"] = params["organization_id"]

    return {"filter_keys": filter_keys, "conditions": conditions}


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(self, query: QueryDict, params: Dict[Any, Any], allow_minute_resolution=True):
        raw_fields = query.getlist("field", [])
        raw_groupby = query.getlist("groupBy", [])
        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {}
        self.aggregations = []
        self.query: List[Any] = []  # not used but needed for compat with sessions logic
        start, end, rollup = get_constrained_date_range(query, allow_minute_resolution)
        self.dataset = _outcomes_dataset(rollup)
        self.rollup = rollup
        self.start = start
        self.end = end

        for key in raw_fields:
            if key not in COLUMN_MAP:
                raise InvalidField(f'Invalid field: "{key}"')
            field = COLUMN_MAP[key]
            self.aggregations.append(field.aggregation(self.dataset))
            self.fields[key] = field

        self.groupby = []
        for key in raw_groupby:
            if key not in DIMENSION_MAP:
                raise InvalidField(f'Invalid groupBy: "{key}"')
            self.groupby.append(DIMENSION_MAP[key])

        if len(query.getlist("category", [])) == 0 and "category" not in raw_groupby:
            raise InvalidQuery("Query must have category as groupby or filter")

        query_columns = set()
        for field in self.fields.values():
            query_columns.update(field.get_snuba_columns(raw_groupby))
        for groupby in self.groupby:
            query_columns.update(groupby.get_snuba_columns())
        self.query_columns = list(query_columns)

        query_groupby = set()
        for groupby in self.groupby:
            query_groupby.update(groupby.get_snuba_groupby())
        self.query_groupby = list(query_groupby)

        snuba_filter = get_filter(query, params)

        self.conditions = snuba_filter["conditions"]
        self.filter_keys = snuba_filter["filter_keys"]


def run_outcomes_query(query: QueryDefinition) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    result = raw_query(
        dataset=query.dataset,
        start=query.start,
        end=query.end,
        groupby=query.query_groupby,
        aggregations=query.aggregations,
        rollup=query.rollup,
        filter_keys=query.filter_keys,
        conditions=query.conditions,
        selected_columns=query.query_columns,
        referrer="outcomes.totals",
        # orderby=query.orderby, TODO: add orderby?
    )
    result_timeseries = raw_query(
        dataset=query.dataset,
        selected_columns=[TS_COL] + query.query_columns,
        groupby=[TS_COL] + query.query_groupby,
        aggregations=query.aggregations,
        conditions=query.conditions,
        filter_keys=query.filter_keys,
        start=query.start,
        end=query.end,
        rollup=query.rollup,
        referrer="outcomes.timeseries",
    )

    result_totals = _format_rows(result["data"], query)
    result_timeseries = _format_rows(result_timeseries["data"], query)
    return result_totals, result_timeseries


def _format_rows(rows: List[Dict[str, Any]], query: QueryDefinition) -> List[Dict[str, Any]]:
    category_grouping: Dict[str, Any] = {}

    def _group_rows(row: Dict[str, Any]) -> None:
        if TS_COL in row:
            grouping_key = "-".join([row[TS_COL]] + [str(row[col]) for col in query.query_groupby])
        else:
            grouping_key = "-".join([str(row[col]) for col in query.query_groupby])

        if grouping_key in category_grouping:
            for field_name, field in query.fields.items():
                row_field = field.get_snuba_columns(None)[0]
                category_grouping[grouping_key][row_field] += field.extract_from_row(row)
        else:
            category_grouping[grouping_key] = row
        return

    for row in rows:
        _rename_row_fields(row)
        _group_rows(row)

    return list(category_grouping.values())


def _rename_row_fields(row: Dict[str, Any]) -> None:
    for dimension in ["category", "reason", "outcome"]:
        DIMENSION_MAP[dimension].map_row(row)
    if TS_COL in row:
        # have to use "time" column -- "timestamp" column doesnt
        # rollup correctly. TODO: look into this
        row[TS_COL] = datetime.utcfromtimestamp(row[TS_COL]).isoformat()


def _outcomes_dataset(rollup: int) -> Dataset:
    if rollup >= 3600:
        # Outcomes is the hourly rollup table
        return Dataset.Outcomes
    else:
        return Dataset.OutcomesRaw


def massage_outcomes_result(
    query: QueryDefinition,
    result_totals: List[Dict[str, Any]],
    result_timeseries: List[Dict[str, Any]],
) -> Dict[str, List[Any]]:
    result = massage_sessions_result(query, result_totals, result_timeseries, ts_col=TS_COL)
    del result["query"]
    return result
