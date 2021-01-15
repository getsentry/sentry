from __future__ import absolute_import

from datetime import datetime

import six
import itertools

from sentry.api.event_search import get_filter
from sentry.api.utils import get_date_range_rollup_from_params
from sentry.utils.dates import to_timestamp
from sentry.utils.snuba import Dataset, raw_query

"""
The new Sessions API defines a "metrics"-like interface which is can be used in
a similar way to "discover".
See https://www.notion.so/sentry/Session-Stats-API-0016d3713d1a4276be0396a338c7930a

# "Metrics"

We have basically 3 "metrics" that we can query:

- `session` (counter): The number of sessions that occurred
- `user` (set): The set of `distinct_id`s.
- `session.duration` (histogram): The duration of individual sessions
  (not available for pre-aggregated sessions)

# "Operations" on metrics

Depending on the metric *type*, we can query different things:

- `counter`: Can only be accessed via the `sum` function.
- `set`: Can only be accessed via the `count_unique` function.
- `histogram`: Can have different quantiles / averages available via:
  `avg`, `p50`...`p99`, `max`.

# Tags / Grouping

The Session data can be grouped by a set of tags, which can only appear in the
`groupBy` of the query.

- `project`
- `environment`
- `release`:
  TODO: describe specific release filters such as `release.major`, etc

## "Virtual" tags

The `session.status` is considered a "virtual" tag, as it does not appear as
such in the current session dataset. Instead the status is represented as
different columns in dataset, and it is "exploded" into distinct groups purely
in code, which is the tricky part.

Essentially, a Row like this:
```
{
    sessions: 123
    sessions_abnormal: 4,
    sessions_crashed: 3,
    sessions_errored: 23,
}
```

Is then "exploded" into something like:

```
[{
    by: { "session.status": "healthy" },
    series: {
        "sum(session)": [100, ...] <- this is `sessions - sessions_errored`
    }
}, {
    by: { "session.status": "errored" },
    series: {
        "sum(session)": [23, ...]
    }
},
...
]
```
"""


class SessionsField(object):
    def get_snuba_columns(self, raw_groupby):
        if "session.status" in raw_groupby:
            return ["sessions", "sessions_abnormal", "sessions_crashed", "sessions_errored"]
        return ["sessions"]

    def extract_from_row(self, row, group):
        if row is None:
            return 0
        status = group.get("session.status")
        if status is None:
            return row["sessions"]
        if status == "healthy":
            return row["sessions"] - row["sessions_errored"]
        if status == "abnormal":
            return row["sessions_abnormal"]
        if status == "crashed":
            return row["sessions_crashed"]
        if status == "errored":
            return row["sessions_errored"]
        return 0


class UsersField(object):
    def get_snuba_columns(self, raw_groupby):
        if "session.status" in raw_groupby:
            return ["users", "users_abnormal", "users_crashed", "users_errored"]
        return ["users"]

    def extract_from_row(self, row, group):
        if row is None:
            return 0
        status = group.get("session.status")
        if status is None:
            return row["users"]
        if status == "healthy":
            return row["users"] - row["users_errored"]
        if status == "abnormal":
            return row["users_abnormal"]
        if status == "crashed":
            return row["users_crashed"]
        if status == "errored":
            return row["users_errored"]
        return 0


class DurationAverageField(object):
    def get_snuba_columns(self, raw_groupby):
        return ["duration_avg"]

    def extract_from_row(self, row, group):
        if row is None:
            return None
        status = group.get("session.status")
        if status is None or status == "healthy":
            return row["duration_avg"]
        return None


class DurationQuantileField(object):
    def __init__(self, quantile_index):
        self.quantile_index = quantile_index

    def get_snuba_columns(self, raw_groupby):
        return ["duration_quantiles"]

    def extract_from_row(self, row, group):
        if row is None:
            return None
        status = group.get("session.status")
        if status is None or status == "healthy":
            return row["duration_quantiles"][self.quantile_index]
        return None


COLUMN_MAP = {
    "sum(session)": SessionsField(),
    "count_unique(user)": UsersField(),
    "avg(session.duration)": DurationAverageField(),
    "p50(session.duration)": DurationQuantileField(0),
    "p75(session.duration)": DurationQuantileField(1),
    "p90(session.duration)": DurationQuantileField(2),
    "p95(session.duration)": DurationQuantileField(3),
    "p99(session.duration)": DurationQuantileField(4),
    "max(session.duration)": DurationQuantileField(5),
}


class SimpleGroupBy(object):
    def __init__(self, row_name, name=None):
        self.row_name = row_name
        self.name = name or row_name

    def get_snuba_columns(self):
        return [self.row_name]

    def get_snuba_groupby(self):
        return [self.row_name]

    def get_keys_for_row(self, row):
        return [(self.name, row[self.row_name])]


class SessionStatusGroupBy(object):
    def get_snuba_columns(self):
        return []

    def get_snuba_groupby(self):
        return []

    def get_keys_for_row(self, row):
        return [("session.status", key) for key in ["healthy", "abnormal", "crashed", "errored"]]


GROUPBY_MAP = {
    "project": SimpleGroupBy("project_id", "project"),
    "environment": SimpleGroupBy("environment"),
    "release": SimpleGroupBy("release"),
    "session.status": SessionStatusGroupBy(),
}


class InvalidField(Exception):
    pass


class QueryDefinition(object):
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(self, query, project_ids=None):
        self.query = query.get("query", "")
        raw_fields = query.getlist("field", [])
        raw_groupby = query.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField(u'Request is missing a "field"')

        self.fields = {}
        for key in raw_fields:
            if key not in COLUMN_MAP:
                raise InvalidField(u'Invalid field: "{}"'.format(key))
            self.fields[key] = COLUMN_MAP[key]

        self.groupby = []
        for key in raw_groupby:
            if key not in GROUPBY_MAP:
                raise InvalidField(u'Invalid groupBy: "{}"'.format(key))
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

        params = {"project_id": project_ids or []}
        snuba_filter = get_filter(self.query, params)

        self.aggregations = snuba_filter.aggregations
        self.conditions = snuba_filter.conditions
        self.filter_keys = snuba_filter.filter_keys


TS_COL = "bucketed_started"


def run_sessions_query(query):
    """
    Runs the `query` as defined by [`QueryDefinition`] two times, once for the
    `totals` and again for the actual time-series data grouped by the requested
    interval.
    """
    result_totals = raw_query(
        dataset=Dataset.Sessions,
        selected_columns=query.query_columns,
        groupby=query.query_groupby,
        aggregations=query.aggregations,
        conditions=query.conditions,
        filter_keys=query.filter_keys,
        start=query.start,
        end=query.end,
        rollup=query.rollup,
        referrer="sessions.totals",
    )

    result_timeseries = raw_query(
        dataset=Dataset.Sessions,
        selected_columns=[TS_COL] + query.query_columns,
        groupby=[TS_COL] + query.query_groupby,
        aggregations=query.aggregations,
        conditions=query.conditions,
        filter_keys=query.filter_keys,
        start=query.start,
        end=query.end,
        rollup=query.rollup,
        referrer="sessions.timeseries",
    )

    return result_totals["data"], result_timeseries["data"]


def massage_sessions_result(query, result_totals, result_timeseries):
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
            row[TS_COL] = row[TS_COL][:19] + "Z"

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
    for key, totals in total_groups.items():
        by = dict(key)

        group = {
            "by": by,
            "totals": make_totals(totals, by),
            "series": make_timeseries(timeseries_groups[key], by),
        }

        groups.append(group)

    return {
        "query": query.query,
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
    return [
        datetime.utcfromtimestamp(ts).isoformat() + "Z"
        for ts in six.moves.xrange(start, end, rollup)
    ]


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
