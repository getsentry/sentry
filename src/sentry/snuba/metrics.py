import enum
import itertools
import random
import re
from abc import ABC, abstractmethod
from collections import OrderedDict
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Union

from snuba_sdk import And, Column, Condition, Entity, Granularity, Limit, Offset, Op, Or, Query
from snuba_sdk.conditions import BooleanCondition
from snuba_sdk.query import SelectableExpression
from typing_extensions import Protocol

from sentry.models import Project
from sentry.sentry_metrics import indexer
from sentry.snuba.sessions_v2 import (  # TODO: unite metrics and sessions_v2
    InvalidField,
    InvalidParams,
    finite_or_none,
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


TS_COL_QUERY = "timestamp"
TS_COL_GROUP = "bucketed_time"


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

    def __init__(self, query_params, allow_minute_resolution=False):

        self.query = query_params.get("query", "")
        self.parsed_query = parse_query(self.query) if self.query else None
        raw_fields = query_params.getlist("field", [])
        self.groupby = query_params.getlist("groupBy", [])

        if len(raw_fields) == 0:
            raise InvalidField('Request is missing a "field"')

        self.fields = {key: parse_field(key) for key in raw_fields}

        start, end, rollup = get_constrained_date_range(
            query_params, allow_minute_resolution, max_points=MAX_POINTS
        )
        self.rollup = rollup
        self.start = start
        self.end = end


class TimeRange(Protocol):
    start: datetime
    end: datetime
    rollup: int


def get_intervals(query: TimeRange):
    start = query.start
    end = query.end
    delta = timedelta(seconds=query.rollup)
    while start < end:
        yield start
        start += delta


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


_OP_TO_FIELD = {
    "metrics_counters": {"sum": "value"},
    "metrics_distributions": {
        "avg": "avg",
        "count": "count",
        "max": "max",
        "min": "min",
        "p50": "percentiles",
        "p75": "percentiles",
        "p90": "percentiles",
        "p95": "percentiles",
        "p99": "percentiles",
    },
    "metrics_sets": {"count_unique": "value"},
}
_FIELDS_BY_ENTITY = {type_: sorted(mapping.keys()) for type_, mapping in _OP_TO_FIELD.items()}


_BASE_TAGS = {
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

_METRICS = {
    "session": {
        "type": "counter",
        "operations": _FIELDS_BY_ENTITY["metrics_counters"],
        "tags": _BASE_TAGS,
    },
    "user": {
        "type": "set",
        "operations": _FIELDS_BY_ENTITY["metrics_sets"],
        "tags": _BASE_TAGS,
    },
    "session.duration": {
        "type": "distribution",
        "operations": _FIELDS_BY_ENTITY["metrics_distributions"],
        "tags": _BASE_TAGS,
        "unit": "seconds",
    },
    "session.error": {
        "type": "set",
        "operations": _FIELDS_BY_ENTITY["metrics_sets"],
        "tags": _BASE_TAGS,
    },
}


def _get_metric(metric_name: str) -> dict:
    try:
        metric = _METRICS[metric_name]
    except KeyError:
        raise InvalidParams(f"Unknown metric '{metric_name}'")

    return metric


class IndexMockingDataSource(DataSource):
    def get_metrics(self, project: Project) -> List[dict]:
        """Get metrics metadata, without tags"""
        return [
            dict(
                name=name,
                **{key: value for key, value in metric.items() if key != "tags"},
            )
            for name, metric in _METRICS.items()
        ]

    def get_single_metric(self, project: Project, metric_name: str) -> dict:
        """Get metadata for a single metric, without tag values"""
        try:
            metric = _METRICS[metric_name]
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

    @classmethod
    def _validate_metric_names(cls, metric_names):
        unknown_metric_names = set(metric_names) - _METRICS.keys()
        if unknown_metric_names:
            raise InvalidParams(f"Unknown metrics '{', '.join(unknown_metric_names)}'")

        return metric_names

    def get_tag_names(self, project: Project, metric_names=None):
        """Get all available tag names for this project

        If ``metric_names`` is provided, the list of available tag names will
        only contain tags that appear in *all* these metrics.
        """
        if metric_names is None:
            return sorted({tag_name for metric in _METRICS.values() for tag_name in metric["tags"]})

        metric_names = self._validate_metric_names(metric_names)

        key_sets = [set(_METRICS[metric_name]["tags"].keys()) for metric_name in metric_names]

        return sorted(set.intersection(*key_sets))

    @classmethod
    def _get_tag_values(cls, metric_name: str, tag_name: str) -> List[str]:
        metric = _get_metric(metric_name)
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
                    for metric in _METRICS.values()
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
    """Mocks metadata and time series"""

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

            metric = _get_metric(metric_name)

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

        intervals = list(get_intervals(query))

        tags = [
            {
                (tag_name, tag_value)
                for metric in _METRICS.values()
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


PERCENTILE_INDEX = {}


class Percentile(enum.Enum):
    p50 = 0
    p75 = 1
    p90 = 2
    p95 = 3
    p99 = 4


class SnubaQueryBuilder:

    _entity_map = {
        "counter": "metrics_counters",
        "distribution": "metrics_distributions",
        "gauge": "metrics_gauges",
        "set": "metrics_sets",
    }

    #: Datasets actually implemented in snuba:
    _implemented_datasets = {
        "metrics_counters",
        "metrics_distributions",
        "metrics_sets",
    }

    def __init__(self, project: Project, query_definition: QueryDefinition):
        self._project = project
        self._queries = self._build_queries(query_definition)

    def _build_logical(self, operator, operands) -> Optional[BooleanCondition]:
        """Snuba only accepts And and Or if they have 2 elements or more"""
        operands = [operand for operand in operands if operand is not None]
        if not operands:
            return None
        if len(operands) == 1:
            return operands[0]

        return operator(operands)

    def _build_filter(self, query_definition: QueryDefinition) -> Optional[BooleanCondition]:
        filter_ = query_definition.parsed_query
        if filter_ is None:
            return None

        def to_int(string):
            try:
                return indexer.resolve(string)
            except KeyError:
                return None

        return self._build_logical(
            Or,
            [
                self._build_logical(
                    And,
                    [
                        Condition(
                            Column(f"tags[{to_int(tag)}]"),
                            Op.EQ,
                            to_int(value),
                        )
                        for tag, value in or_operand["and"]
                    ],
                )
                for or_operand in filter_["or"]
            ],
        )

    def _build_where(
        self, query_definition: QueryDefinition
    ) -> List[Union[BooleanCondition, Condition]]:
        where: List[Union[BooleanCondition, Condition]] = [
            Condition(Column("org_id"), Op.EQ, self._project.organization_id),
            Condition(Column("project_id"), Op.EQ, self._project.id),
            Condition(
                Column("metric_id"),
                Op.IN,
                [indexer.resolve(name) for _, name in query_definition.fields.values()],
            ),
            Condition(Column(TS_COL_QUERY), Op.GTE, query_definition.start),
            Condition(Column(TS_COL_QUERY), Op.LT, query_definition.end),
        ]
        filter_ = self._build_filter(query_definition)
        if filter_:
            where.append(filter_)

        return where

    def _build_groupby(self, query_definition: QueryDefinition) -> List[SelectableExpression]:
        return [Column("metric_id")] + [
            Column(f"tags[{indexer.resolve(field)}]") for field in query_definition.groupby
        ]

    def _build_queries(self, query_definition):

        queries_by_entity = OrderedDict()
        for op, metric_name in query_definition.fields.values():
            type_ = _get_metric(metric_name)["type"]
            entity = self._get_entity(type_)
            queries_by_entity.setdefault(entity, []).append((op, metric_name))

        where = self._build_where(query_definition)
        groupby = self._build_groupby(query_definition)

        return {
            entity: self._build_queries_for_entity(query_definition, entity, fields, where, groupby)
            for entity, fields in queries_by_entity.items()
        }

    def _build_queries_for_entity(self, query_definition, entity, fields, where, groupby):
        totals_query = Query(
            dataset="metrics",
            match=Entity(entity),
            groupby=groupby,
            select=list(
                map(
                    Column,
                    {_OP_TO_FIELD[entity][op] for op, _ in fields},
                )
            ),
            where=where,
            limit=Limit(MAX_POINTS),
            offset=Offset(0),
            granularity=Granularity(query_definition.rollup),
        )
        series_query = totals_query.set_groupby(
            (totals_query.groupby or []) + [Column(TS_COL_GROUP)]
        )

        return {
            "totals": totals_query,
            "series": series_query,
        }

    def get_snuba_queries(self):
        return self._queries

    def _get_entity(self, metric_type: str) -> str:

        entity = self._entity_map[metric_type]

        if entity not in self._implemented_datasets:
            raise NotImplementedError(f"Dataset not yet implemented: {entity}")

        return entity


_DEFAULT_AGGREGATES = {
    "avg": None,
    "count_unique": 0,
    "count": 0,
    "max": None,
    "p50": None,
    "p75": None,
    "p90": None,
    "p95": None,
    "p99": None,
    "sum": 0,
}


class SnubaResultConverter:
    """Interpret a Snuba result and convert it to API format"""

    def __init__(
        self,
        organization_id: int,
        query_definition: QueryDefinition,
        intervals: List[datetime],
        results,
    ):
        self._organization_id = organization_id
        self._query_definition = query_definition
        self._intervals = intervals
        self._results = results

        self._ops_by_metric = ops_by_metric = {}
        for op, metric in query_definition.fields.values():
            ops_by_metric.setdefault(metric, []).append(op)

        self._timestamp_index = {timestamp: index for index, timestamp in enumerate(intervals)}

    def _parse_tag(self, tag_string: str) -> str:
        tag_key = int(tag_string.replace("tags[", "").replace("]", ""))
        return indexer.reverse_resolve(tag_key)

    def _extract_data(self, entity, data, groups):
        tags = tuple((key, data[key]) for key in sorted(data.keys()) if key.startswith("tags["))

        metric_name = indexer.reverse_resolve(data["metric_id"])
        ops = self._ops_by_metric[metric_name]

        tag_data = groups.setdefault(
            tags,
            {
                "totals": {},
                "series": {},
            },
        )

        timestamp = data.pop(TS_COL_GROUP, None)

        for op in ops:
            key = f"{op}({metric_name})"
            series = tag_data["series"].setdefault(
                key, len(self._intervals) * [_DEFAULT_AGGREGATES[op]]
            )

            field = _OP_TO_FIELD[entity][op]
            value = data[field]
            if field == "percentiles":
                value = value[Percentile[op].value]

            # If this is time series data, add it to the appropriate series.
            # Else, add to totals
            if timestamp is None:
                tag_data["totals"][key] = finite_or_none(value)
            else:
                series_index = self._timestamp_index[timestamp]
                series[series_index] = finite_or_none(value)

    def translate_results(self):
        groups = {}

        for entity, subresults in self._results.items():
            totals = subresults["totals"]["data"]
            for data in totals:
                self._extract_data(entity, data, groups)

            series = subresults["series"]["data"]
            for data in series:
                self._extract_data(entity, data, groups)

        groups = [
            dict(
                by={self._parse_tag(key): indexer.reverse_resolve(value) for key, value in tags},
                **data,
            )
            for tags, data in groups.items()
        ]

        return groups


class SnubaDataSource(IndexMockingDataSource):
    """Mocks metrics metadata and string indexing, but fetches real time series"""

    def get_series(self, project: Project, query: QueryDefinition) -> dict:
        """Get time series for the given query"""

        intervals = list(get_intervals(query))

        snuba_queries = SnubaQueryBuilder(project, query).get_snuba_queries()
        results = {
            entity: {
                # TODO: Should we use cache?
                key: raw_snql_query(query, use_cache=False, referrer=f"api.metrics.{key}")
                for key, query in queries.items()
            }
            for entity, queries in snuba_queries.items()
        }

        converter = SnubaResultConverter(project.organization_id, query, intervals, results)

        return {
            "start": query.start,
            "end": query.end,
            "query": query.query,
            "intervals": intervals,
            "groups": converter.translate_results(),
        }
