import itertools
import logging
import math
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import pytz
from snuba_sdk import Column, Condition, Function, Limit, Op

from sentry.api.utils import get_date_range_from_params
from sentry.release_health.base import AllowedResolution, SessionsQueryConfig
from sentry.search.events.builder import SessionsV2QueryBuilder, TimeseriesSessionsV2QueryBuilder
from sentry.utils.dates import parse_stats_period, to_datetime, to_timestamp
from sentry.utils.snuba import Dataset

logger = logging.getLogger(__name__)


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
            healthy_sessions = row["sessions"] - row["sessions_errored"]
            return max(healthy_sessions, 0)
        if status == "abnormal":
            return row["sessions_abnormal"]
        if status == "crashed":
            return row["sessions_crashed"]
        if status == "errored":
            errored_sessions = (
                row["sessions_errored"] - row["sessions_crashed"] - row["sessions_abnormal"]
            )
            return max(errored_sessions, 0)
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
            healthy_users = row["users"] - row["users_errored"]
            return max(healthy_users, 0)
        if status == "abnormal":
            return row["users_abnormal"]
        if status == "crashed":
            return row["users_crashed"]
        if status == "errored":
            errored_users = row["users_errored"] - row["users_crashed"] - row["users_abnormal"]
            return max(errored_users, 0)
        return 0


def finite_or_none(val):
    if isinstance(val, (int, float)) and not math.isfinite(val):
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
    def __init__(self, row_name: str, name: Optional[str] = None):
        self.row_name = row_name
        self.name = name or row_name

    def get_snuba_columns(self) -> List[str]:
        return [self.row_name]

    def get_snuba_groupby(self) -> List[str]:
        return [self.row_name]

    def get_keys_for_row(self, row) -> List[Tuple[str, str]]:
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


class InvalidField(Exception):
    pass


class ZeroIntervalsException(Exception):
    pass


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(
        self,
        query,
        params,
        query_config: SessionsQueryConfig,
        limit: Optional[int] = 0,
        offset: Optional[int] = 0,
    ):
        self.query = query.get("query", "")
        self.raw_fields = raw_fields = query.getlist("field", [])
        self.raw_groupby = raw_groupby = query.getlist("groupBy", [])
        self.raw_orderby = query.getlist("orderBy")  # only respected by metrics implementation
        self.limit = limit
        self.offset = offset
        self._query_config = query_config

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {}
        for key in raw_fields:
            if key not in COLUMN_MAP:
                from sentry.release_health.metrics_sessions_v2 import FIELD_MAP

                if key in FIELD_MAP:
                    # HACK : Do not raise an error for metrics-only fields,
                    # Simply ignore them instead.
                    #
                    # It is important to note that this ignore can lead to the
                    # self.primary_column not being initialized.
                    continue

                raise InvalidField(f'Invalid field: "{key}"')

            self.fields[key] = COLUMN_MAP[key]

        self.groupby = []
        for key in raw_groupby:
            if key not in GROUPBY_MAP:
                raise InvalidField(f'Invalid groupBy: "{key}"')

            self.groupby.append(GROUPBY_MAP[key])

        start, end, rollup = get_constrained_date_range(
            query,
            allowed_resolution=query_config.allowed_resolution,
            restrict_date_range=query_config.restrict_date_range,
        )
        self.rollup = rollup
        self.start = start
        self.end = end

        self.params = params

        query_columns = set()
        for i, (field_name, field) in enumerate(self.fields.items()):
            columns = field.get_snuba_columns(raw_groupby)
            if i == 0 or field_name == "sum(session)":  # Prefer first, but sum(session) always wins
                self.primary_column = columns[0]  # Will be used in order by
            query_columns.update(columns)

        for groupby in self.groupby:
            query_columns.update(groupby.get_snuba_columns())
        self.query_columns = list(query_columns)

        query_groupby = set()
        for groupby in self.groupby:
            query_groupby.update(groupby.get_snuba_groupby())
        self.query_groupby = list(query_groupby)

    def to_query_builder_dict(self, orderby=None):
        num_intervals = len(get_timestamps(self))
        if num_intervals == 0:
            raise ZeroIntervalsException

        max_groups = SNUBA_LIMIT // num_intervals

        query_builder_dict = {
            "dataset": Dataset.Sessions,
            "params": {
                **self.params,
                "start": self.start,
                "end": self.end,
            },
            "selected_columns": self.query_columns,
            "groupby_columns": self.query_groupby,
            "query": self.query,
            "orderby": orderby,
            "limit": max_groups,
            "auto_aggregations": True,
            "granularity": self.rollup,
        }
        if self._query_config.allow_session_status_query:
            query_builder_dict.update({"extra_filter_allowlist_fields": ["session.status"]})
        return query_builder_dict

    def get_filter_conditions(self):
        """
        Returns filter conditions for the query to be used for metrics queries, and hence excluding timestamp and
        organization id condition that are later added by the metrics layer.
        """
        conditions = SessionsV2QueryBuilder(**self.to_query_builder_dict()).where
        filter_conditions = []
        for condition in conditions:
            # Exclude sessions "started" timestamp condition and org_id condition, as it is not needed for metrics queries.
            if (
                isinstance(condition, Condition)
                and isinstance(condition.lhs, Column)
                and condition.lhs.name in ["started", "org_id"]
            ):
                continue
            filter_conditions.append(condition)
        return filter_conditions

    def __repr__(self):
        return f"{self.__class__.__name__}({repr(self.__dict__)})"


MAX_POINTS = 1000  # max. points in time
ONE_DAY = timedelta(days=1).total_seconds()
ONE_HOUR = timedelta(hours=1).total_seconds()
ONE_MINUTE = timedelta(minutes=1).total_seconds()

#: We know that a limit of 1000 is too low for some UI use cases, e.g.
#: https://sentry.io/organizations/sentry/projects/sentry/?project=1&statsPeriod=14d
#: (2 * 14d * 24h * 4 statuses = 2688 groups).
#: At the same time, there is no justification from UI perspective to increase
#: the limit to the absolute maximum of 10000 (see https://github.com/getsentry/snuba/blob/69862db3ad224b48810ac1bb3001e4c446bf0aff/snuba/query/snql/parser.py#L908-L909).
#: -> Let's go with 5000, so we can still serve the 50 releases over 90d that are used here:
#: https://github.com/getsentry/sentry/blob/d6ed7c12844b70edb6a93b4f33d3e60e8516105a/static/app/views/releases/list/releasesAdoptionChart.tsx#L91-L96
SNUBA_LIMIT = 5000


class InvalidParams(Exception):
    pass


class NonPreflightOrderByException(InvalidParams):
    """
    An exception that is raised when parsing orderBy, to indicate that this is only an exception
    in the case where we don't run a preflight query on an accepted pre-flight query field
    """

    ...


def get_now():
    """Wrapper function to make it mockable in unit tests"""
    return datetime.now(tz=pytz.utc)


def get_constrained_date_range(
    params,
    allowed_resolution: AllowedResolution = AllowedResolution.one_hour,
    max_points=MAX_POINTS,
    restrict_date_range=True,
) -> Tuple[datetime, datetime, int]:
    interval = parse_stats_period(params.get("interval", "1h"))
    interval = int(3600 if interval is None else interval.total_seconds())

    smallest_interval, interval_str = allowed_resolution.value
    if interval % smallest_interval != 0 or interval < smallest_interval:
        raise InvalidParams(
            f"The interval has to be a multiple of the minimum interval of {interval_str}."
        )

    if interval > ONE_DAY:
        raise InvalidParams("The interval has to be less than one day.")

    if ONE_DAY % interval != 0:
        raise InvalidParams("The interval should divide one day without a remainder.")

    using_minute_resolution = interval % ONE_HOUR != 0

    start, end = get_date_range_from_params(params)
    now = get_now()

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

    # Hack to disabled rounding interval for metrics-based queries:
    if interval < ONE_MINUTE:
        rounding_interval = interval

    date_range = timedelta(
        seconds=int(rounding_interval * math.ceil(date_range.total_seconds() / rounding_interval))
    )

    if using_minute_resolution and restrict_date_range:
        if date_range.total_seconds() > 6 * ONE_HOUR:
            raise InvalidParams(
                "The time-range when using one-minute resolution intervals is restricted to 6 hours."
            )
        if (now - start).total_seconds() > 30 * ONE_DAY:
            raise InvalidParams(
                "The time-range when using one-minute resolution intervals is restricted to the last 30 days."
            )

    if date_range.total_seconds() / interval > max_points:
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


def _run_sessions_query(query):
    """
    Runs the `query` as defined by [`QueryDefinition`] two times, once for the
    `totals` and again for the actual time-series data grouped by the requested
    interval.
    """
    # If we don't have any fields that can be derived from raw fields, it doesn't make sense to even
    # run the query in the first place.
    if len(query.fields) == 0:
        return [], []

    # We only return the top-N groups, based on the first field that is being
    # queried, assuming that those are the most relevant to the user.
    # In a future iteration we might expose an `orderBy` query parameter.
    #
    # In case we don't have a primary column because only metrics-only fields have been supplied to
    # the query definition we just avoid the order by under the assumption that the result set of
    # the query will be empty.
    orderby = [f"-{query.primary_column}"] if hasattr(query, "primary_column") else None

    try:
        query_builder_dict = query.to_query_builder_dict(orderby=orderby)
    except ZeroIntervalsException:
        return [], []

    result_totals = SessionsV2QueryBuilder(**query_builder_dict).run_query("sessions.totals")[
        "data"
    ]
    if not result_totals:
        # No need to query time series if totals is already empty
        return [], []

    # We only get the time series for groups which also have a total:
    if query.query_groupby:
        # E.g. (release, environment) IN [(1, 2), (3, 4), ...]
        groups = {tuple(row[column] for column in query.query_groupby) for row in result_totals}

        extra_conditions = [
            Condition(
                Function("tuple", [Column(col) for col in query.query_groupby]),
                Op.IN,
                Function("tuple", list(groups)),
            )
        ] + [
            Condition(
                Column(column),
                Op.IN,
                Function("tuple", list({row[column] for row in result_totals})),
            )
            for column in query.query_groupby
        ]
    else:
        extra_conditions = []

    timeseries_query_builder = TimeseriesSessionsV2QueryBuilder(**query_builder_dict)
    timeseries_query_builder.where.extend(extra_conditions)
    timeseries_query_builder.limit = Limit(SNUBA_LIMIT)
    result_timeseries = timeseries_query_builder.run_query("sessions.timeseries")["data"]

    return result_totals, result_timeseries


def massage_sessions_result(
    query, result_totals, result_timeseries, ts_col=TS_COL
) -> Dict[str, List[Any]]:
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
    timestamps = get_timestamps(query)

    total_groups = _split_rows_groupby(result_totals, query.groupby)
    timeseries_groups = _split_rows_groupby(result_timeseries, query.groupby)

    def make_timeseries(rows, group):
        for row in rows:
            row[ts_col] = row[ts_col][:19] + "Z"

        rows.sort(key=lambda row: row[ts_col])
        fields = [(name, field, list()) for name, field in query.fields.items()]
        group_index = 0

        while group_index < len(rows):
            row = rows[group_index]
            if row[ts_col] < timestamps[0]:
                group_index += 1
            else:
                break

        for ts in timestamps:
            row = rows[group_index] if group_index < len(rows) else None
            if row is not None and row[ts_col] == ts:
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
        }
        if result_timeseries is not None:
            group["series"] = make_timeseries(timeseries_groups.get(key, []), by)

        groups.append(group)

    return {
        "start": isoformat_z(query.start),
        "end": isoformat_z(query.end),
        "query": query.query,
        "intervals": timestamps,
        "groups": groups,
    }


def isoformat_z(date):
    return datetime.utcfromtimestamp(int(to_timestamp(date))).isoformat() + "Z"


def get_timestamps(query):
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
    if rows is None:
        return groups
    for row in rows:
        key_parts = (group.get_keys_for_row(row) for group in groupby)
        keys = itertools.product(*key_parts)

        for key in keys:
            key = frozenset(key)

            if key not in groups:
                groups[key] = []
            groups[key].append(row)

    return groups
