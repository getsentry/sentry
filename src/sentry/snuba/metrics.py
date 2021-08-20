import itertools
import random
import re
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Tuple

from sentry_relay.metrics import to_metrics_symbol
from snuba_sdk import Column, Condition, Entity, Function, Granularity, Limit, Offset, Op, Query

from sentry.models import Project
from sentry.snuba.sessions_v2 import (  # TODO: unite metrics and sessions_v2
    InvalidField,
    InvalidParams,
    get_constrained_date_range,
)
from sentry.utils.snuba import raw_snql_query

FIELD_REGEX = re.compile(r"^(\w+)\(((\w|\.|_)+)\)$")
TAG_REGEX = re.compile(r"^(\w|\.|_)+$")

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

#: Max number of data points per time series:
MAX_POINTS = 10000


TS_COL = "timestamp"


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


def verify_tag_name(name: str) -> str:

    if not TAG_REGEX.match(name):
        raise InvalidParams(f"Invalid tag name: '{name}'")

    return name


def parse_tag(tag_string: str) -> Tuple[str, str]:
    try:
        name, value = tag_string.split(":")
    except ValueError:
        raise InvalidParams(f"Expected something like 'foo:\"bar\"' for tag, got '{tag_string}'")

    return (verify_tag_name(name), value.strip('"'))


def parse_query(query_string: str) -> dict:
    return {
        "or": [
            {"and": [parse_tag(and_part) for and_part in or_part.split(" and ")]}
            for or_part in query_string.split(" or ")
        ]
    }


class QueryDefinition:
    """
    This is the definition of the query the user wants to execute.
    This is constructed out of the request params, and also contains a list of
    `fields` and `groupby` definitions as [`ColumnDefinition`] objects.


    Adapted from [`sentry.snuba.sessions_v2`].

    """

    _entity_map = {
        "session": "metrics_counters",
        "user": "metrics_sets",
        "session.duration": "metrics_distributions",
    }

    #: Datasets actually implemented in snuba:
    _implemented_datasets = {
        "metrics_sets",
    }

    def __init__(self, query_params, allow_minute_resolution=False):

        self.query = query_params.get("query", "")
        raw_fields = query_params.getlist("field", [])
        self.groupby = query_params.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {key: parse_field(key) for key in raw_fields}

        # HACK: Define a single field for now:
        if len(self.fields) != 1:
            # Would have to fetch from multiple datasets
            raise NotImplementedError
        self.field, (self.op, self.metric_name) = next(iter(self.fields.items()))

        self.match = self._get_entity(self.metric_name)

        start, end, rollup = get_constrained_date_range(
            query_params, allow_minute_resolution, max_points=MAX_POINTS
        )
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

    def _get_entity(self, metric_name) -> str:

        entity = self._entity_map[metric_name]

        if entity not in self._implemented_datasets:
            raise NotImplementedError(f"Dataset not yet implemented: {entity}")

        return entity


class DataSource(ABC):
    """Base class for metrics data sources"""

    @abstractmethod
    def get_metrics(self, project: Project) -> List[dict]:
        """Get metrics metadata, without tags"""

    @abstractmethod
    def get_single_metric(self, project: Project, metric_name: str) -> dict:
        """Get metadata for a single metric, without tag values"""

    @abstractmethod
    def get_series(self, project: Project, query: QueryDefinition) -> dict:
        """Get time series for the given query"""

    @abstractmethod
    def get_tag_names(self, project: Project, metric_names=None):
        """Get all available tag names for this project

        If ``metric_names`` is provided, the list of available tag names will
        only contain tags that appear in *all* these metrics.
        """

    @abstractmethod
    def get_tag_values(self, project: Project, tag_name: str, metric_names=None) -> List[str]:
        """Get all known values for a specific tag"""


class IndexMockingDataSource(DataSource):

    _base_tags = {}
    _metrics = {}

    def get_metrics(self, project: Project) -> List[dict]:
        """Get metrics metadata, without tags"""
        return [
            dict(
                name=name,
                **{key: value for key, value in metric.items() if key != "tags"},
            )
            for name, metric in self._metrics.items()
        ]

    def get_single_metric(self, project: Project, metric_name: str) -> dict:
        """Get metadata for a single metric, without tag values"""
        try:
            metric = self._metrics[metric_name]
        except KeyError:
            raise InvalidParams()

        return dict(
            name=metric_name,
            **{
                # Only return metric names
                key: (sorted(value.keys()) if key == "tags" else value)
                for key, value in metric.items()
            },
        )

    def _verify_query(self, query: QueryDefinition):
        if not query.query:
            return

        parse_query(query.query)

    @classmethod
    def _get_metric(cls, metric_name: str) -> dict:
        try:
            metric = cls._metrics[metric_name]
        except KeyError:
            raise InvalidParams(f"Unknown metric '{metric_name}'")

        return metric

    @classmethod
    def _validate_metric_names(cls, metric_names):
        unknown_metric_names = set(metric_names) - cls._metrics.keys()
        if unknown_metric_names:
            raise InvalidParams(f"Unknown metrics '{', '.join(unknown_metric_names)}'")

        return metric_names

    def get_tag_names(self, project: Project, metric_names=None):
        """Get all available tag names for this project

        If ``metric_names`` is provided, the list of available tag names will
        only contain tags that appear in *all* these metrics.
        """
        if metric_names is None:
            return sorted(
                {tag_name for metric in self._metrics.values() for tag_name in metric["tags"]}
            )

        metric_names = self._validate_metric_names(metric_names)

        key_sets = [set(self._metrics[metric_name]["tags"].keys()) for metric_name in metric_names]

        return sorted(set.intersection(*key_sets))

    @classmethod
    def _get_tag_values(cls, metric_name: str, tag_name: str) -> List[str]:
        metric = cls._get_metric(metric_name)
        try:
            tags = metric["tags"][tag_name]
        except KeyError:
            raise InvalidParams(f"Unknown tag '{tag_name}'")

        return tags

    def get_tag_values(self, project: Project, tag_name: str, metric_names=None) -> List[str]:

        if metric_names is None:
            return sorted(
                {
                    tag_value
                    for metric in self._metrics.values()
                    for tag_value in metric["tags"].get(
                        tag_name, []
                    )  # TODO: validation of tag name
                }
            )

        metric_names = self._validate_metric_names(metric_names)

        value_sets = [
            set(self._get_tag_values(metric_name, tag_name)) for metric_name in metric_names
        ]

        return sorted(set.intersection(*value_sets))


class MockDataSource(IndexMockingDataSource):

    _base_tags = {
        "environment": [
            "production",
            "staging",
        ],
        "release": [  # High cardinality
            f"myapp@{major}.{minor}.{bugfix}"
            for major in range(3)
            for minor in range(13)
            for bugfix in range(4)
        ],
        "session.status": [
            "abnormal",
            "crashed",
            "errored",
            "healthy",
        ],
    }

    _metrics = {
        "session": {
            # "type": "counter",
            "operations": ["sum"],
            "tags": dict(_base_tags, custom_session_tag=["foo", "bar"]),
        },
        "user": {
            # "type": "set",
            "operations": ["count_unique"],
            "tags": dict(_base_tags, custom_user_tag=[""]),
        },
        "session.duration": {
            # "type": "distribution",
            "operations": ["avg", "p50", "p75", "p90", "p95", "p99", "max"],
            "tags": _base_tags,
            "unit": "seconds",
        },
        "parallel_users": {
            # "type": "gauge",
            "operations": ["avg", "count", "max", "min", "sum"],
            "tags": _base_tags,
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

    def _generate_series(self, fields: dict, intervals: List[datetime]) -> dict:

        series = {}
        totals = {}
        for field, (operation, metric_name) in fields.items():

            metric = self._get_metric(metric_name)

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

    def get_series(self, project: Project, query: QueryDefinition) -> dict:
        """Get time series for the given query"""

        intervals = list(query.get_intervals())

        self._verify_query(query)

        tags = [
            {
                (tag_name, tag_value)
                for metric in self._metrics.values()
                for tag_value in metric["tags"].get(tag_name, [])
            }
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


class StringIndexer:
    """
    Converts metrics tags from integer to string and vice versa.

    Currently mocked & limited to a set of known metrics / tags.

    TODO: Make this a utils.Service
    """

    _to_string = {
        to_metrics_symbol(name): name
        for name in [
            "abnormal",
            "crashed",
            "environment",
            "errored",
            "healthy",
            "production",
            "release",
            "session.duration",
            "session",
            "staging",
            "user",
        ]
    }

    def get_string(self, value: int) -> str:
        return self._to_string[value]

    def get_int(self, value: str) -> int:
        return to_metrics_symbol(value)


class SnubaDataSource(IndexMockingDataSource):

    _base_tags = {
        "environment": [
            "production",
            "staging",
        ],
        "release": [],
        "session.status": [
            "abnormal",
            "crashed",
            "errored",
            "healthy",
        ],
    }

    _metrics = {
        "session": {
            # "type": "counter",
            "operations": ["sum"],
            "tags": _base_tags,
        },
        "user": {
            # "type": "set",
            "operations": ["count_unique"],
            "tags": _base_tags,
        },
        "session.duration": {
            # "type": "distribution",
            "operations": ["avg", "p50", "p75", "p90", "p95", "p99", "max"],
            "tags": _base_tags,
            "unit": "seconds",
        },
        "parallel_users": {
            # "type": "gauge",
            "operations": ["avg", "count", "max", "min", "sum"],
            "tags": _base_tags,
            "unit": "seconds",
        },
    }

    _dataset = "metrics"

    _indexer = StringIndexer()

    #: Map operation to snuba / clickhouse function
    _op_map = {
        "count_unique": None,  # values already give you uniq
    }

    def get_series(self, project: Project, query: QueryDefinition) -> dict:
        """Get time series for the given query"""

        intervals = list(query.get_intervals())

        self._verify_query(query)

        total = self._run_query_totals(project, query)

        return {
            "start": query.start,
            "end": query.end,
            "query": query.query,
            "intervals": intervals,
            "groups": [
                {
                    "by": {},  # TODO: handle tags
                    "totals": {query.field: total},  # TODO: handle multiple fields
                }
            ],
        }

    def _run_query_totals(self, project: Project, query: QueryDefinition):

        metric_id = self._indexer.get_int(query.metric_name)
        function = self._op_map[query.op]

        snql_query = Query(
            dataset=self._dataset,
            match=Entity(query.match),
            select=[
                (Function(function, [Column("value")], "value") if function else Column("value"))
            ],
            # groupby=[Column(field) for field in query.groupby],
            where=[
                Condition(Column("org_id"), Op.EQ, project.organization.id),
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("metric_id"), Op.EQ, metric_id),
                Condition(Column(TS_COL), Op.GTE, query.start),
                Condition(Column(TS_COL), Op.LT, query.end),
                # TODO: filter by tag values
            ],
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=Granularity(query.rollup),
        )
        result = raw_snql_query(snql_query, referrer="metrics.totals")
        return result["data"][0]["value"]

    # def _run_query_timeseries(self, query: QueryDefinition):
    #     snql_query = Query(
    #         dataset=self._dataset,
    #         match=Entity(query.match),
    #         select=query.select_params,
    #         groupby=query.groupby + [Column(TS_COL)],
    #         where=query.conditions,
    #         limit=Limit(MAX_POINTS),
    #         offset=Offset(0),
    #         granularity=Granularity(query.rollup),
    #     )
    #     result_timeseries = raw_snql_query(snql_query, referrer="outcomes.timeseries")
    #     return _format_rows(result_timeseries["data"], query)


DATA_SOURCE = SnubaDataSource()
