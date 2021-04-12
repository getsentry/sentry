import itertools
import math
import random
import re
from datetime import datetime, timedelta
from typing import Dict, List, Tuple

import pytz

from sentry.models import Project
from sentry.snuba.sessions_v2 import (  # TODO: unite metrics and sessions_v2
    InvalidField,
    InvalidParams,
    get_date_range_from_params,
    parse_stats_period,
    to_datetime,
    to_timestamp,
)

FIELD_REGEX = re.compile(r"^(\w+)\(((\w|\.)+)\)$")

OPERATIONS = (
    "avg",
    "count_unique",
    "count",
    "max",
    "p50",
    "p75",
    "p90",
    "p95",
    "p99",
    "sum",
)


def parse_field(field: str) -> Tuple[str, str]:
    matches = FIELD_REGEX.match(field)
    try:
        operation = matches[1]
        metric_name = matches[2]
    except (IndexError, TypeError):
        raise InvalidField(f"Failed to parse '{field}'. Must be something like 'sum(my_metric)'.")
    else:
        if operation not in OPERATIONS:

            raise InvalidField(
                f"Invalid operation '{operation}'. Must be one of {', '.join(OPERATIONS)}"
            )

        return operation, metric_name


MAX_POINTS = 1000
ONE_DAY = timedelta(days=1).total_seconds()
ONE_HOUR = timedelta(hours=1).total_seconds()
ONE_MINUTE = timedelta(minutes=1).total_seconds()


def get_constrained_date_range(
    params, allow_minute_resolution=False
) -> Tuple[datetime, datetime, int]:
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

    # using_minute_resolution = interval % ONE_HOUR != 0

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

    # TODO: restrictions

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


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.


    Adapted from [`sentry.snuba.sessions_v2`].

    """

    def __init__(self, query_params, allow_minute_resolution=False):
        self.query = query_params.get("query", "")
        raw_fields = query_params.getlist("field", [])
        self.groupby = query_params.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {key: parse_field(key) for key in raw_fields}

        start, end, rollup = get_constrained_date_range(query_params, allow_minute_resolution)
        self.rollup = rollup
        self.start = start
        self.end = end

    def get_intervals(self):
        start = self.start
        end = self.end
        delta = timedelta(seconds=self.rollup)
        while start < end:
            yield start
            start += delta


class MockDataSource:

    _tags = {
        "environment": [
            "production",
            "staging",
        ],
        "release": [  # High cardinality
            f"{major}.{minor}.{bugfix}"
            for major in range(3)
            for minor in range(13)
            for bugfix in range(4)
        ],
        "session.status": [
            "crashed",
            "errored",
            "healthy",
        ],
    }
    _tag_names = sorted(_tags.keys())

    _metrics = {
        "session": {
            # "type": "counter",
            "operations": ["sum"],
            "tags": _tag_names,
        },
        "user": {
            # "type": "set",
            "operations": ["count_unique"],
            "tags": _tag_names,
        },
        "session.duration": {
            # "type": "distribution",
            "operations": ["avg", "p50", "p75", "p90", "p95", "p99", "max"],
            "tags": _tag_names,
            "unit": "seconds",
        },
        "parallel_users": {
            # "type": "gauge",
            "operations": ["avg", "count", "max", "min", "sum"],
            "tags": _tag_names,
            "unit": "seconds",
        },
    }

    #: Used to compute totals from series
    #: NOTE: Not mathematically correct but plausible mock
    _operations = {
        "avg": lambda values: sum(values) / len(values),
        "count_unique": lambda values: 3 * sum(values) // len(values),
        "count": sum,
        "max": max,
        "p50": lambda values: values[int(0.50 * len(values))],
        "p75": lambda values: values[int(0.75 * len(values))],
        "p90": lambda values: values[int(0.90 * len(values))],
        "p95": lambda values: values[int(0.95 * len(values))],
        "p99": lambda values: values[int(0.99 * len(values))],
        "sum": sum,
    }

    def get_metrics(self, project: Project) -> List[dict]:

        return [dict(name=name, **metric) for name, metric in self._metrics.items()]

    def _generate_series(self, fields: dict, intervals: List[datetime]) -> dict:

        series = {}
        totals = {}
        for field, (operation, metric_name) in fields.items():
            try:
                metric = self._metrics[metric_name]
            except KeyError:
                raise InvalidParams(f"Unknown metric '{metric_name}'")

            if operation not in metric["operations"]:
                raise InvalidParams(f"Invalid operation '{operation}' for metric '{metric_name}'")

            mu = 1000 * random.random()
            series[field] = [random.normalvariate(mu, 50) for _ in intervals]

            if operation == "count_unique":
                series[field] = list(map(int, series[field]))

            totals[field] = self._operations[operation](series[field])

        return {
            "totals": totals,
            "series": series,
        }

    def get_series(self, query: QueryDefinition) -> dict:
        """ Get time series for the given query """
        intervals = list(query.get_intervals())

        for tag_name in query.groupby:
            if tag_name not in self._tags:
                raise InvalidParams(f"Unknown tag '{tag_name}'")
        tags = [
            [(tag_name, tag_value) for tag_value in self._tags[tag_name]]
            for tag_name in query.groupby
        ]

        return {
            "start": query.start,
            "end": query.end,
            "query": query.query,
            "intervals": intervals,
            "groups": [
                dict(
                    by={tag_name: tag_value for tag_name, tag_value in combination},
                    **self._generate_series(query.fields, intervals),
                )
                for combination in itertools.product(*tags)
            ]
            if tags
            else [dict(by={}, **self._generate_series(query.fields, intervals))],
        }

    def get_tag_values(self, project: Project, metric_name: str, tag_name: str) -> Dict[str, str]:
        # Return same tag names for every metric for now:
        return self._tags.get(tag_name, [])


DATA_SOURCE = MockDataSource()
