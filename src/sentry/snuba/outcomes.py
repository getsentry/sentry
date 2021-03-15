from sentry.utils.snuba import Dataset, raw_query
from sentry_relay import DataCategory

from sentry.api.utils import get_date_range_rollup_from_params
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome
from datetime import datetime
import itertools

"""
The new Outcomes API defines a "metrics"-like interface which is can be used in
a similar way to "discover".
See https://www.notion.so/sentry/Session-Stats-API-0016d3713d1a4276be0396a338c7930a

# "Metrics"

We have basically 3 "metrics" that we can query:

- `quantity` (counter): The relevant stat based on category:
        standard event: # of outcomes
        session: number of events within the session
        attachment: quantity in bytes of attachments
- `times_seen` (counter): The number of outcomes that occurred --
        differs from quantity in that:
            it would count # of attachments, and sessions
            if we ever aggregate multiple events into one outcome,
            this would be used to get the number of outcomes
- `event_ids` (set): The set of `distinct_id`s. TODO: add this in

# "Operations" on metrics

Depending on the metric *type*, we can query different things:

- `counter`: Can only be accessed via the `sum` function.
- `set`: Can only be accessed via the `count_unique` function.

# Tags / Grouping

The Outcome data can be grouped by a set of tags, which can only appear in the
`groupBy` of the query.

- `project`
- `key_id`
- `outcome`
- `reason`
- `category`
```
"""


class QuantityField:
    def get_snuba_columns(self, raw_groupby):
        return ["quantity"]

    def extract_from_row(self, row, group=None):
        if row is None:
            return 0
        return row["quantity"]

    def unit_value(self, row, group):
        if row is None:
            return 0
        return row["quantity"]


class TimesSeenField:
    def get_snuba_columns(self, raw_groupby):
        return ["times_seen"]

    def extract_from_row(self, row, group=None):
        if row is None:
            return 0
        return row["times_seen"]

    def unit_value(self, row, group):
        return "count"


class ErrorGroupby:
    def __init__(self, row_name, name=None):
        self.row_name = row_name
        self.name = name or row_name

    def get_snuba_columns(self):
        return [self.row_name]

    def get_snuba_groupby(self):
        return [self.row_name]

    def get_keys_for_row(self, row):
        return [(self.name, row[self.row_name])]


class SimpleGroupBy:
    def __init__(self, row_name, name=None):
        self.row_name = row_name
        self.name = name or row_name

    def get_snuba_columns(self):
        return [self.row_name]

    def get_snuba_groupby(self):
        return [self.row_name]

    def get_keys_for_row(self, row):
        return [(self.name, row[self.row_name])]


class InvalidField(Exception):  # TODO: move to common
    pass


COLUMN_MAP = {
    "sum(quantity)": QuantityField(),
    "sum(times_seen)": TimesSeenField(),
}

GROUPBY_MAP = {
    "project": SimpleGroupBy("project_id", "project"),
    "key": SimpleGroupBy("key_id"),
    "outcome": SimpleGroupBy("outcome"),
    "category": SimpleGroupBy("category"),
    "reason": SimpleGroupBy("reason"),
}

CONDITION_COLUMNS = ["project", "key", "outcome", "category", "reason"]


def resolve_column(col):
    if col in CONDITION_COLUMNS:
        return col
    raise InvalidField(f'Invalid query field: "{col}"')


TS_COL = "time"


def get_filter(query, params):
    filter_keys = {}
    conditions = []

    category = query.getlist("category", [])
    # category = [DataCategory.error_categories() if c == DataCategory.ERROR else DataCategory.parse(c) for c in category]
    resolved_categories = set()
    for c in category:
        if DataCategory.parse(c) == DataCategory.ERROR:
            resolved_categories.update(DataCategory.error_categories())
        else:
            resolved_categories.add(DataCategory.parse(c))
    category = resolved_categories

    outcome = query.getlist("outcome", [])
    outcome = [Outcome.parse(o) for o in outcome]
    reason = query.getlist("reason", [])
    if "project_id" in params:
        filter_keys["project_id"] = params["project_id"]
    if "organization" in params:
        filter_keys["organization_id"] = params["organization_id"]
    if len(category) > 0:
        conditions.append(["category", "IN", category])
    if len(outcome) > 0:
        conditions.append(["outcome", "IN", outcome])
    if len(reason) > 0:
        conditions.append(["reason", "IN", reason])
    return {"filter_keys": filter_keys, "conditions": conditions}


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(self, query, params):
        raw_fields = query.getlist("field", [])
        raw_groupby = query.getlist("groupBy", [])
        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {}
        self.aggregations = []
        for key in raw_fields:
            if key not in COLUMN_MAP:
                raise InvalidField(f'Invalid field: "{key}"')
            self.fields[key] = COLUMN_MAP[key]
            if key == "sum(quantity)":
                self.aggregations.append(["sum", "quantity", "quantity"])
            if key == "sum(times_seen)":
                self.aggregations.append(["sum", "times_seen", "times_seen"])

        self.groupby = []
        for key in raw_groupby:
            if key not in GROUPBY_MAP:
                raise InvalidField(f'Invalid groupBy: "{key}"')
            self.groupby.append(GROUPBY_MAP[key])

        start, end, rollup = get_date_range_rollup_from_params(query, "1h", round_range=True)
        self.rollup = rollup
        self.start = start
        self.end = end

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


def run_outcomes_query(query):
    # TODO: add spans, referer
    result = raw_query(
        dataset=Dataset.Outcomes,
        start=query.start,
        end=query.end,
        groupby=query.query_groupby,
        aggregations=query.aggregations,
        rollup=query.rollup,
        filter_keys=query.filter_keys,
        conditions=query.conditions,
        # selected_columns=query.query_columns,
        # orderby=query.orderby, TODO: add orderby?
    )
    result_timeseries = raw_query(
        dataset=Dataset.Outcomes,
        # selected_columns=[TS_COL] + query.query_columns,
        groupby=[TS_COL] + query.query_groupby,
        aggregations=query.aggregations,
        conditions=query.conditions,
        filter_keys=query.filter_keys,
        start=query.start,
        end=query.end,
        rollup=query.rollup,
    )

    result = _format_rows(result["data"], query)
    result_timeseries = _format_rows(result_timeseries["data"], query)
    # TODO: what to do about coalescing reasons?
    return result, result_timeseries


def _format_rows(rows, query):
    category_grouping = {}

    for row in rows:
        if "category" in row:
            category = (
                DataCategory.ERROR
                if row["category"] in DataCategory.error_categories()
                else DataCategory(row["category"])
            )
            row["category"] = category.api_name()
        if "outcome" in row:
            row["outcome"] = Outcome(row["outcome"]).api_name()
        if TS_COL in row:
            # have to use "time" column -- "timestamp" column doesnt
            # rollup correctly. TODO: look into this
            row[TS_COL] = datetime.utcfromtimestamp(row[TS_COL]).isoformat()

            grouping_key = "-".join([row[TS_COL]] + [str(row[col]) for col in query.query_groupby])
        else:
            grouping_key = "-".join([str(row[col]) for col in query.query_groupby])

        if grouping_key in category_grouping:
            for field_name, field in query.fields.items():
                row_field = field.get_snuba_columns(None)[0]
                category_grouping[grouping_key][row_field] += field.extract_from_row(row)
        else:
            category_grouping[grouping_key] = row

    return list(category_grouping.values())


def _outcomes_dataset(rollup):
    if rollup >= 3600:
        # Outcomes is the hourly rollup table
        return Dataset.Outcomes
    else:
        return Dataset.OutcomesRaw


def massage_outcomes_result(query, result_totals, result_timeseries):
    """
    Post-processes the query result.

    Given the `query` as defined by [`QueryDefinition`] and its totals and
    timeseries results from snuba, groups and transforms the result into the
    expected format.

    For example:
    ```json
    {
      "intervals": [
        "2020-12-16T00:00:00Z",
        "2020-12-16T12:00:00Z",
        "2020-12-17T00:00:00Z"
      ],
      "groups": [
        {
          "by": { "release": "99b8edc5a3bb49d01d16426d7bb9c511ec41f81e" },
          "series": { "sum(session)": [0, 1, 0] },
          "totals": { "sum(session)": 1 }
        },
        {
          "by": { "release": "test-example-release" },
          "series": { "sum(session)": [0, 10, 20] },
          "totals": { "sum(session)": 30 }
        }
      ]
    }
    ```
    """
    timestamps = _get_timestamps(query)

    total_groups = _split_rows_groupby(result_totals, query.groupby)
    timeseries_groups = _split_rows_groupby(result_timeseries, query.groupby)

    def make_timeseries(rows, group):
        for row in rows:
            row[TS_COL] = row[TS_COL][:19] + "Z"  # TODO: what is going on with this?

        rows.sort(key=lambda row: row[TS_COL])
        fields = [(name, field, list()) for name, field in query.fields.items()]
        group_index = 0

        while group_index < len(rows):
            row = rows[group_index]
            if row[TS_COL] < timestamps[0]:
                group_index += 1
            else:
                break

        for ts in timestamps:
            row = rows[group_index] if group_index < len(rows) else None
            if row is not None and row[TS_COL] == ts:
                group_index += 1
            else:
                row = None
            for (name, field, series) in fields:
                series.append(field.extract_from_row(row, group))

        return {name: series for (name, field, series) in fields}

    def make_totals(totals, group):
        return {
            name: field.extract_from_row(totals[0], group) for name, field in query.fields.items()
        }

    groups = []
    keys = set(total_groups.keys()) | set(timeseries_groups.keys())
    for key in keys:
        by = dict(key)

        group = {
            "by": by,
            "totals": make_totals(total_groups.get(key, [None]), by),
            "series": make_timeseries(timeseries_groups.get(key, []), by),
        }

        groups.append(group)

    return {
        "intervals": timestamps,
        "groups": groups,
    }


def _get_timestamps(query):
    """
    Generates a list of timestamps according to `query`.
    The timestamps are returned as ISO strings for now.
    """
    rollup = query.rollup
    start = int(to_timestamp(query.start))
    end = int(to_timestamp(query.end))
    return [datetime.utcfromtimestamp(ts).isoformat() + "Z" for ts in range(start, end, rollup)]


def _split_rows_groupby(rows, groupby):
    groups = {}
    for row in rows:
        key_parts = (group.get_keys_for_row(row) for group in groupby)
        keys = itertools.product(*key_parts)

        for key in keys:
            key = frozenset(key)

            if key not in groups:
                groups[key] = []
            groups[key].append(row)

    return groups
