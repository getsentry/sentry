from __future__ import annotations

import itertools
import logging
import math
from datetime import datetime, timedelta, timezone
from typing import Any, NotRequired, Protocol, TypedDict

from snuba_sdk import BooleanCondition, Column, Condition, Function

from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.release_health.base import AllowedResolution, SessionsQueryConfig
from sentry.search.events.builder.sessions import SessionsV2QueryBuilder
from sentry.search.events.types import QueryBuilderConfig
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics.utils import to_intervals
from sentry.utils.dates import parse_stats_period
from sentry.utils.outcomes import Outcome

logger = logging.getLogger(__name__)

dropped_outcomes = [
    Outcome.INVALID.api_name(),
    Outcome.RATE_LIMITED.api_name(),
    Outcome.CARDINALITY_LIMITED.api_name(),
]


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


class _Field(Protocol):
    def extract_from_row(self, row, group) -> float | None: ...
    def get_snuba_columns(self, raw_groupby) -> list[str]: ...


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


COLUMN_MAP: dict[str, _Field] = {
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


class _GroupBy(Protocol):
    def get_snuba_columns(self) -> list[str]: ...
    def get_snuba_groupby(self) -> list[str]: ...
    def get_keys_for_row(self, row) -> list[tuple[str, str]]: ...


class SimpleGroupBy:
    def __init__(self, row_name: str, name: str | None = None):
        self.row_name = row_name
        self.name = name or row_name

    def get_snuba_columns(self) -> list[str]:
        return [self.row_name]

    def get_snuba_groupby(self) -> list[str]:
        return [self.row_name]

    def get_keys_for_row(self, row) -> list[tuple[str, str]]:
        return [(self.name, row[self.row_name])]


class SessionStatusGroupBy:
    def get_snuba_columns(self):
        return []

    def get_snuba_groupby(self):
        return []

    def get_keys_for_row(self, row):
        return [("session.status", key) for key in ["healthy", "abnormal", "crashed", "errored"]]


# NOTE: in the future we might add new `user_agent` and `os` fields

GROUPBY_MAP: dict[str, _GroupBy] = {
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
        limit: int | None = 0,
        offset: int | None = 0,
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
            "granularity": self.rollup,
            "config": QueryBuilderConfig(auto_aggregations=True),
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
            self._check_supported_condition(condition)

            # Exclude sessions "started" timestamp condition and org_id condition, as it is not needed for metrics
            # queries.
            if (
                isinstance(condition, Condition)
                and isinstance(condition.lhs, Column)
                and condition.lhs.name in ["started", "org_id"]
            ):
                continue
            filter_conditions.append(condition)

        return filter_conditions

    @classmethod
    def _check_supported_condition(cls, condition):
        if isinstance(condition, BooleanCondition):
            for nested_condition in condition.conditions:
                cls._check_supported_condition(nested_condition)
        elif isinstance(condition, Condition):
            if isinstance(condition.lhs, Function):
                # Since we moved to metrics backed sessions, we don't allow wildcard search anymore. The reason for this
                # is that we don't store tag values as strings in the database, this makes wildcard match on the
                # db impossible. The solution would be to lift it out at the application level, but it will impact
                # performance.
                if condition.lhs.function == "match":
                    raise InvalidField("Invalid condition: wildcard search is not supported")

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


class NonPreflightOrderByException(InvalidParams):
    """
    An exception that is raised when parsing orderBy, to indicate that this is only an exception
    in the case where we don't run a preflight query on an accepted pre-flight query field
    """

    ...


def get_now():
    """Wrapper function to make it mockable in unit tests"""
    return datetime.now(tz=timezone.utc)


def get_constrained_date_range(
    params,
    allowed_resolution: AllowedResolution = AllowedResolution.one_hour,
    max_points=MAX_POINTS,
    restrict_date_range=True,
) -> tuple[datetime, datetime, int]:
    interval_td = parse_stats_period(params.get("interval", "1h"))
    interval = int(3600 if interval_td is None else interval_td.total_seconds())

    smallest_interval, interval_str = allowed_resolution.value
    if interval % smallest_interval != 0 or interval < smallest_interval:
        raise InvalidParams(
            f"The interval has to be a multiple of the minimum interval of {interval_str}."
        )

    if interval > ONE_DAY:
        raise InvalidParams("The interval has to be less than one day.")

    if ONE_DAY % interval != 0:
        raise InvalidParams("The interval should divide one day without a remainder.")

    start, end = get_date_range_from_params(params)
    now = get_now()

    if start > now:
        start = now

    adjusted_start, adjusted_end, _num_intervals = to_intervals(start, end, interval)

    date_range = adjusted_end - adjusted_start

    if date_range.total_seconds() / interval > max_points:
        raise InvalidParams(
            "Your interval and date range would create too many results. "
            "Use a larger interval, or a smaller date range."
        )

    return adjusted_start, adjusted_end, interval


TS_COL = "bucketed_started"


def massage_sessions_result(
    query, result_totals, result_timeseries, ts_col=TS_COL
) -> dict[str, list[Any]]:
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
        fields: list[tuple[str, _Field, list[float | None]]]
        fields = [(name, field, []) for name, field in query.fields.items()]
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

            for name, field, series in fields:
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


class _CategoryStats(TypedDict):
    category: str
    outcomes: dict[str, int]
    totals: dict[str, int]
    reason: NotRequired[str]


def massage_sessions_result_summary(
    query, result_totals, outcome_query=None
) -> tuple[dict[int, dict[str, dict[str, _CategoryStats]]], dict[str, list[Any]]]:
    """
    Post-processes the query result.

    Given the `query` as defined by [`QueryDefinition`] and its totals and
    timeseries results from snuba, groups and transforms the result into the
    expected format.

    For example:
    ```json
    {
      "start": "2020-12-16T00:00:00Z",
      "end": "2020-12-16T12:00:00Z",
      "projects": [
        {
          "id": 1,
          "stats": [
            {
              "category": "error",
              "outcomes": {
                "accepted": 6,
                "filtered": 0,
                "rate_limited": 1,
                "invalid": 0,
                "abuse": 0,
                "client_discard": 0,
                "cardinality_limited": 0,
              },
              "totals": {
                "dropped": 1,
                "sum(quantity)": 7,
              },
            }
          ]
        }
      ]
    }
    ```
    """
    total_groups = _split_rows_groupby(result_totals, query.groupby)

    def make_totals(totals, group):
        return {
            name: field.extract_from_row(totals[0], group) for name, field in query.fields.items()
        }

    def get_category_stats(
        reason, totals, outcome, category, category_stats: _CategoryStats | None = None
    ) -> _CategoryStats:
        if not category_stats:
            category_stats = {
                "category": category,
                "outcomes": (
                    {o.api_name(): 0 for o in Outcome}
                    if not outcome_query
                    else {o: 0 for o in outcome_query}
                ),
                "totals": {},
            }
            if not outcome_query or any([o in dropped_outcomes for o in outcome_query]):
                category_stats["totals"] = {"dropped": 0}
            if reason:
                category_stats["reason"] = reason

        for k, v in totals.items():
            if k in category_stats["totals"]:
                category_stats["totals"][k] += v
            else:
                category_stats["totals"][k] = v

            category_stats["outcomes"][outcome] += v
            if outcome in dropped_outcomes:
                category_stats["totals"]["dropped"] += v

        return category_stats

    keys = set(total_groups.keys())
    projects: dict[int, dict[str, dict[str, _CategoryStats]]] = {}

    for key in keys:
        by = dict(key)
        project_id = by["project"]
        outcome = by["outcome"]
        category = by["category"]
        reason = by.get("reason")  # optional

        totals = make_totals(total_groups.get(key, [None]), by)

        projects.setdefault(project_id, {"categories": {}})

        if category in projects[project_id]["categories"]:
            # update stats dict for category
            projects[project_id]["categories"][category] = get_category_stats(
                reason, totals, outcome, category, projects[project_id]["categories"][category]
            )
        else:
            # create stats dict for category
            projects[project_id]["categories"][category] = get_category_stats(
                reason, totals, outcome, category
            )

    projects = dict(sorted(projects.items()))
    ids = projects.keys()
    project_id_to_slug = dict(Project.objects.filter(id__in=ids).values_list("id", "slug"))
    formatted_projects = []

    # format stats for each project
    for key, values in projects.items():
        categories = values["categories"]
        project_dict = {"id": key, "slug": project_id_to_slug[key], "stats": []}

        for key, stats in categories.items():
            project_dict["stats"].append(stats)

        project_dict["stats"].sort(key=lambda d: d["category"])

        formatted_projects.append(project_dict)

    return projects, {
        "start": isoformat_z(query.start),
        "end": isoformat_z(query.end),
        "projects": formatted_projects,
    }


def isoformat_z(date):
    return datetime.fromtimestamp(int(date.timestamp())).isoformat() + "Z"


def get_timestamps(query):
    """
    Generates a list of timestamps according to `query`.
    The timestamps are returned as ISO strings for now.
    """
    rollup = query.rollup
    start = int(query.start.timestamp())
    end = int(query.end.timestamp())

    return [datetime.fromtimestamp(ts).isoformat() + "Z" for ts in range(start, end, rollup)]


def _split_rows_groupby(rows, groupby):
    groups: dict[frozenset[str], list[object]] = {}
    if rows is None:
        return groups
    for row in rows:
        key_parts = (group.get_keys_for_row(row) for group in groupby)
        keys = itertools.product(*key_parts)

        for key_tup in keys:
            key = frozenset(key_tup)

            groups.setdefault(key, []).append(row)

    return groups
