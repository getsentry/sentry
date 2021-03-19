from datetime import datetime, timedelta
import itertools
import math
import pytz

from sentry.api.event_search import get_filter
from sentry.api.utils import get_date_range_from_params
from sentry.utils.dates import parse_stats_period, to_timestamp, to_datetime
from sentry.utils.snuba import Dataset, raw_query, resolve_condition

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


class SessionsField:
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


class UsersField:
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


def finite_or_none(val):
    if not math.isfinite(val):
        return None
    return val


class DurationAverageField:
    def get_snuba_columns(self, raw_groupby):
        return ["duration_avg"]

    def extract_from_row(self, row, group):
        if row is None:
            return None
        status = group.get("session.status")
        if status is None or status == "healthy":
            return finite_or_none(row["duration_avg"])
        return None


class DurationQuantileField:
    def __init__(self, quantile_index):
        self.quantile_index = quantile_index

    def get_snuba_columns(self, raw_groupby):
        return ["duration_quantiles"]

    def extract_from_row(self, row, group):
        if row is None:
            return None
        status = group.get("session.status")
        if status is None or status == "healthy":
            return finite_or_none(row["duration_quantiles"][self.quantile_index])
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


class SessionStatusGroupBy:
    def get_snuba_columns(self):
        return []

    def get_snuba_groupby(self):
        return []

    def get_keys_for_row(self, row):
        return [("session.status", key) for key in ["healthy", "abnormal", "crashed", "errored"]]


# NOTE: in the future we might add new `user_agent` and `os` fields

GROUPBY_MAP = {
    "project": SimpleGroupBy("project_id", "project"),
    "environment": SimpleGroupBy("environment"),
    "release": SimpleGroupBy("release"),
    "session.status": SessionStatusGroupBy(),
}

CONDITION_COLUMNS = ["project", "environment", "release"]


def resolve_column(col):
    if col in CONDITION_COLUMNS:
        return col
    raise InvalidField(f'Invalid query field: "{col}"')


class InvalidField(Exception):
    pass


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(self, query, params, allow_minute_resolution=False):
        self.query = query.get("query", "")
        raw_fields = query.getlist("field", [])
        raw_groupby = query.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {}
        for key in raw_fields:
            if key not in COLUMN_MAP:
                raise InvalidField(f'Invalid field: "{key}"')
            self.fields[key] = COLUMN_MAP[key]

        self.groupby = []
        for key in raw_groupby:
            if key not in GROUPBY_MAP:
                raise InvalidField(f'Invalid groupBy: "{key}"')
            self.groupby.append(GROUPBY_MAP[key])

        start, end, rollup = _get_constrained_date_range(query, allow_minute_resolution)
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

        # the `params` are:
        # project_id, organization_id, environment;
        # also: start, end; but we got those ourselves.
        snuba_filter = get_filter(self.query, params)

        # this makes sure that literals in complex queries are properly quoted,
        # and unknown fields are raised as errors
        conditions = [resolve_condition(c, resolve_column) for c in snuba_filter.conditions]

        self.aggregations = snuba_filter.aggregations
        self.conditions = conditions
        self.filter_keys = snuba_filter.filter_keys


MAX_POINTS = 1000
ONE_DAY = timedelta(days=1).total_seconds()
ONE_HOUR = timedelta(hours=1).total_seconds()
ONE_MINUTE = timedelta(minutes=1).total_seconds()


class InvalidParams(Exception):
    pass


def _get_constrained_date_range(params, allow_minute_resolution=False):
    interval = parse_stats_period(params.get("interval", "1h"))
    interval = int(3600 if interval is None else interval.total_seconds())

    smallest_interval = ONE_MINUTE if allow_minute_resolution else ONE_HOUR
    if interval % smallest_interval != 0 or interval < smallest_interval:
        interval_str = "one minute" if allow_minute_resolution else "one hour"
        raise InvalidParams(
            f"The interval has to be a multiple of the minimum interval of {interval_str}."
        )

    if interval > ONE_DAY:
        raise InvalidParams("The interval has to be less than one day.")

    if ONE_DAY % interval != 0:
        raise InvalidParams("The interval should divide one day without a remainder.")

    using_minute_resolution = interval % ONE_HOUR != 0

    start, end = get_date_range_from_params(params)
    now = datetime.now(tz=pytz.utc)

    # if `end` is explicitly given, we add a second to it, so it is treated as
    # inclusive. the rounding logic down below will take care of the rest.
    if params.get("end"):
        end += timedelta(seconds=1)

    date_range = end - start
    # round the range up to a multiple of the interval.
    # the minimum is 1h so the "totals" will not go out of sync, as they will
    # use the materialized storage due to no grouping on the `started` column.
    # NOTE: we can remove the difference between `interval` / `rounding_interval`
    # as soon as snuba can provide us with grouped totals in the same query
    # as the timeseries (using `WITH ROLLUP` in clickhouse)
    rounding_interval = int(math.ceil(interval / ONE_HOUR) * ONE_HOUR)
    date_range = timedelta(
        seconds=int(rounding_interval * math.ceil(date_range.total_seconds() / rounding_interval))
    )

    if using_minute_resolution:
        if date_range.total_seconds() > 6 * ONE_HOUR:
            raise InvalidParams(
                "The time-range when using one-minute resolution intervals is restricted to 6 hours."
            )
        if (now - start).total_seconds() > 30 * ONE_DAY:
            raise InvalidParams(
                "The time-range when using one-minute resolution intervals is restricted to the last 30 days."
            )

    if date_range.total_seconds() / interval > MAX_POINTS:
        raise InvalidParams(
            "Your interval and date range would create too many results. "
            "Use a larger interval, or a smaller date range."
        )

    end_ts = int(rounding_interval * math.ceil(to_timestamp(end) / rounding_interval))
    end = to_datetime(end_ts)
    # when expanding the rounding interval, we would adjust the end time too far
    # to the future, in which case the start time would not actually contain our
    # desired date range. adjust for this by extend the time by another interval.
    # for example, when "45m" means the range from 08:49:00-09:34:00, our rounding
    # has to go from 08:00:00 to 10:00:00.
    if rounding_interval > interval and (end - date_range) > start:
        date_range += timedelta(seconds=rounding_interval)
    start = end - date_range

    # snuba <-> sentry has a 5 minute cache for *exact* queries, which these
    # are because of the way we do our rounding. For that reason we round the end
    # of "realtime" queries to one minute into the future to get a one-minute cache instead.
    if end > now:
        end = to_datetime(ONE_MINUTE * (math.floor(to_timestamp(now) / ONE_MINUTE) + 1))

    return start, end, interval


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
        "start": _isoformat_z(query.start),
        "end": _isoformat_z(query.end),
        "query": query.query,
        "intervals": timestamps,
        "groups": groups,
    }


def _isoformat_z(date):
    return datetime.utcfromtimestamp(int(to_timestamp(date))).isoformat() + "Z"


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
