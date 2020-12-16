from __future__ import absolute_import

from datetime import datetime
from rest_framework.response import Response

import six
import sentry_sdk

from sentry.api.bases import OrganizationEventsV2EndpointBase
from sentry.api.event_search import get_filter, InvalidSearchQuery
from sentry.utils.compat import filter, map
from sentry.utils.dates import get_rollup_from_request
from sentry.utils.snuba import Dataset, raw_query, to_naive_timestamp, naiveify_datetime


class ColumnDefinition(object):
    """
    This defines the column mapping from a discover-like `name` to the
    `snuba_columns` that feed into it.

    An `extractor` function can be given that transforms the raw data columns
    into the expected output. By default, it will just use the single `snuba_columns`.

    A `default` must also be provided which is used when the row does not contain
    any data.
    """

    def __init__(self, name, snuba_columns, default, extractor=None):
        self.name = name
        self.snuba_columns = snuba_columns
        self.default = default
        self.extractor = extractor

    def extract(self, row):
        if row is None:
            return self.default

        if self.extractor is not None:
            value = self.extractor(row)
        elif len(self.snuba_columns) == 1:
            value = row[self.snuba_columns[0]]
        else:
            return self.default

        return value if value is not None else self.default


# Lets assume we have a recent enough snuba.
# TODO: Also, maybe we can run a custom aggregation over the `duration_quantiles`?
QUANTILE_MAP = {50: 0, 75: 1, 90: 2, 95: 3, 99: 4, 100: 5}


def extract_quantile(num):
    def inner(row):
        return row["duration_quantiles"][QUANTILE_MAP[num]]

    return inner


COLUMNS = [
    ColumnDefinition("sum(session)", ["sessions"], 0),
    ColumnDefinition(
        "sum(session.healthy)",
        ["sessions", "sessions_errored"],
        0,
        lambda row: row["sessions"] - row["sessions_errored"],
    ),
    ColumnDefinition("sum(session.errored)", ["sessions_errored"], 0),
    ColumnDefinition("sum(session.abnormal)", ["sessions_abnormal"], 0),
    ColumnDefinition("sum(session.crashed)", ["sessions_crashed"], 0),
    ColumnDefinition("count_unique(user)", ["users"], 0),
    ColumnDefinition(
        "count_unique(user.healthy)",
        ["users", "users_errored"],
        0,
        lambda row: row["users"] - row["users_errored"],
    ),
    ColumnDefinition("count_unique(user.errored)", ["users_errored"], 0),
    ColumnDefinition("count_unique(user.abnormal)", ["users_abnormal"], 0),
    ColumnDefinition("count_unique(user.crashed)", ["users_crashed"], 0),
    ColumnDefinition("p50(session.duration)", ["duration_quantiles"], None, extract_quantile(50)),
    ColumnDefinition("p75(session.duration)", ["duration_quantiles"], None, extract_quantile(75)),
    ColumnDefinition("p90(session.duration)", ["duration_quantiles"], None, extract_quantile(90)),
    ColumnDefinition("p95(session.duration)", ["duration_quantiles"], None, extract_quantile(95)),
    ColumnDefinition("p99(session.duration)", ["duration_quantiles"], None, extract_quantile(99)),
    ColumnDefinition("max(session.duration)", ["duration_quantiles"], None, extract_quantile(100)),
    ColumnDefinition("avg(session.duration)", ["duration_avg"], None),
    ColumnDefinition("release", ["release"], ""),
    ColumnDefinition("environment", ["environment"], ""),
    ColumnDefinition("user_agent", ["user_agent"], ""),
    ColumnDefinition("os", ["os"], ""),
]

COLUMN_MAP = {column.name: column for column in COLUMNS}


class QueryDefinition(object):
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.
    """

    def __init__(self, request, params):
        # self.request = request
        # self.params = params

        self.query = request.GET.get("query")
        raw_fields = request.GET.getlist("field", [])
        raw_groupby = request.GET.getlist("groupBy", [])

        # TODO: maybe show a proper error message for unknown fields/groupby
        self.fields = filter(None, (COLUMN_MAP.get(field) for field in raw_fields))
        self.groupby = filter(None, (COLUMN_MAP.get(field) for field in raw_groupby))

        rollup = get_rollup_from_request(
            request,
            params,
            "1h",
            InvalidSearchQuery(
                "Your interval and date range would create too many results. "
                "Use a larger interval, or a smaller date range."
            ),
        )
        # The minimum interval is one hour on the server
        self.rollup = max(rollup, 3600)

        def extract_columns(lists):
            columns = set()
            for l in lists:
                for field in l:
                    for column in field.snuba_columns:
                        columns.add(column)
            return list(columns)

        self.query_columns = extract_columns([self.fields, self.groupby])
        self.query_groupby = extract_columns([self.groupby])

        snuba_filter = get_timeseries_snuba_filter(
            self.query_columns, self.query, params, self.rollup
        )

        self.start = snuba_filter.start
        self.end = snuba_filter.end
        self.aggregations = snuba_filter.aggregations
        self.conditions = snuba_filter.conditions

        self.filter_keys = snuba_filter.filter_keys


TS_COL = "bucketed_started"


class OrganizationSessionsEndpoint(OrganizationEventsV2EndpointBase):
    def get(self, request, organization):
        # with self.handle_query_errors():
        query = self.build_sessions_query(request, organization)
        result_totals, result_timeseries = run_sessions_query(query)
        result = massage_sessions_result(query, result_totals, result_timeseries)
        return Response(result, status=200)

    def build_sessions_query(self, request, organization):
        with sentry_sdk.start_span(op="sessions.endpoint", description="build_sessions_query"):
            params = self.get_snuba_params(request, organization, check_global_views=False)

            return QueryDefinition(request, params)


def get_timeseries_snuba_filter(selected_columns, query, params, rollup, default_count=True):
    snuba_filter = get_filter(query, params)
    if not snuba_filter.start and not snuba_filter.end:
        raise InvalidSearchQuery("Cannot get timeseries result without a start and end.")

    return snuba_filter


def get_timestamps(query):
    """
    Generates a list of timestamps according to `query`.
    The timestamps are printed as strings.
    """
    rollup = query.rollup
    start = int(to_naive_timestamp(naiveify_datetime(query.start)) / rollup) * rollup
    end = (int(to_naive_timestamp(naiveify_datetime(query.end)) / rollup) * rollup) + rollup
    return [
        datetime.utcfromtimestamp(ts).isoformat() for ts in six.moves.xrange(start, end, rollup)
    ]


def run_sessions_query(query):
    """
    Runs the `query` as defined by [`QueryDefinition`] two times, once for the
    `totals` and again for the actual time-series data grouped by the requested
    interval.
    """
    with sentry_sdk.start_span(op="sessions.discover", description="run_sessions_query"):
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

        return result_totals, result_timeseries


def sane_groupby(it, keyfn):
    """
    Basically the same as `itertools.groupby`, but without the requirement to
    have the iterable sorted already by the keys, which can be super confusing
    and breaks in surprising ways.
    """
    groups = {}
    for elem in it:
        key = keyfn(elem)
        if key not in groups:
            groups[key] = []
        groups[key].append(elem)

    return groups


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
    with sentry_sdk.start_span(op="sessions.discover", description="massage_sessions_result"):
        timestamps = get_timestamps(query)

        def group_fn(row):
            return tuple(field.extract(row) for field in query.groupby)

        total_groups = sane_groupby(result_totals["data"], group_fn)
        timeseries_groups = sane_groupby(result_timeseries["data"], group_fn)

        def make_timeseries(group):
            for row in group:
                row[TS_COL] = row[TS_COL][:19]

            group.sort(key=lambda row: row[TS_COL])
            fields = [(field, list()) for field in query.fields]
            group_index = 0

            while group_index < len(group):
                row = group[group_index]
                if row[TS_COL] < timestamps[0]:
                    group_index += 1
                else:
                    break

            for ts in timestamps:
                row = group[group_index] if group_index < len(group) else None
                if row is not None and row[TS_COL] == ts:
                    group_index += 1
                else:
                    row = None

                for (field, series) in fields:
                    series.append(field.extract(row))

            return {field.name: series for (field, series) in fields}

        def make_totals(totals):
            return {field.name: field.extract(totals[0]) for field in query.fields}

        groups = [
            {
                "by": {field.name: key[i] for i, field in enumerate(query.groupby)},
                "totals": make_totals(totals),
                "series": make_timeseries(timeseries_groups[key]),
            }
            for key, totals in total_groups.items()
        ]

        return {
            # "query": query.query,
            "intervals": map(lambda ts: ts + "Z", timestamps),
            "groups": groups,
            # "raw_timeseries": result_timeseries["data"],
            # "raw_totals": result_totals["data"],
        }
