import collections.abc
import inspect
from copy import deepcopy
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, List, Mapping, Optional, Sequence, Set, TypeVar, Union

from dateutil import parser
from typing_extensions import Literal

from sentry.release_health.base import (
    CrashFreeBreakdown,
    CurrentAndPreviousCrashFreeRates,
    EnvironmentName,
    OrganizationId,
    OverviewStat,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ProjectReleaseSessionStats,
    ProjectReleaseUserStats,
    ProjectWithCount,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryResult,
    StatsPeriod,
)
from sentry.release_health.metrics import MetricsReleaseHealthBackend
from sentry.release_health.sessions import SessionsReleaseHealthBackend
from sentry.snuba.sessions import get_rollup_starts_and_buckets
from sentry.snuba.sessions_v2 import QueryDefinition

DateLike = TypeVar("DateLike", datetime, str)


class ComparatorType(Enum):
    Counter = "counter"
    Ratio = "ratio"
    Quantile = "quantile"
    Entity = "entity"
    DateTime = "datetime"
    Ignore = "ignore"


Schema = Union[ComparatorType, List["Schema"], Mapping[str, "Schema"], Set["Schema"]]


def _get_calling_method():
    """
    This assumes the method is the second function on the frame
    (as is the case when called for compare_results and log_exception)
    :return:
    """
    return inspect.stack()[2].function


def compare_entities(sessions, metrics, path: str) -> Optional[str]:
    if sessions != metrics:
        return f"field {path} contains different data sessions={sessions} metrics={metrics}"


def _compare_basic(sessions, metrics, path: str) -> (bool, Optional[str]):
    """
    Runs basic comparisons common to most implementations,

    If the first value in the return tuple is true the comparison is finished the the second
    value can be returned as a result
    """
    if sessions is None and metrics is None:
        return True, None
    if sessions is None:
        return True, f"field {path} only present in metrics implementation"
    if metrics is None:
        return True, f"field {path} missing from metrics implementation"
    return False, None


def compare_datetime(
    sessions: Optional[DateLike], metrics: Optional[DateLike], rollup: int, path: str
) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if type(sessions) != type(metrics):
        return f"field {path} inconsistent types return sessions={type(sessions)}, metrics={type(metrics)}"
    if type(sessions) == str:
        try:
            sessions_d = parser.parse(sessions)
            metrics_d = parser.parse(metrics)
            dd = abs(sessions_d - metrics_d)
        except parser.ParserError:
            return f"field {path} could not parse dates sessions={sessions}, metrics={metrics}"
    else:
        dd = abs(sessions - metrics)
    if dd > timedelta(seconds=rollup):
        return f"field {path} failed to mach datetimes sessions={sessions}, metrics={metrics}"
    return None


def compare_counters(sessions: Optional[int], metrics: Optional[int], path: str) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if metrics < 0:
        return f"invalid field {path} value={metrics}, from metrics, only positive values are expected. "
    if sessions < 0:
        return f"sessions ERROR, Invalid field {path} value = {sessions}, from sessions, only positive values are expected. "
    if (sessions <= 10 and metrics > 10) or (metrics <= 10 and sessions > 10):
        if abs(sessions - metrics) > 4:
            return f"fields with different values at {path} sessions={sessions}, metrics={metrics}"
        else:
            return None
    if metrics <= 10:
        if abs(sessions - metrics) > 3:
            return f"fields with different values at {path} sessions={sessions}, metrics={metrics}"
        else:
            return None
    else:
        if float(abs(sessions - metrics)) / metrics > 0.05:
            return f"fields with different values at {path} sessions={sessions}, metrics={metrics}"
    return None


def compare_ratios(sessions: Optional[float], metrics: Optional[float], path: str) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if metrics < 0:
        return f"invalid field {path} value = {metrics}, from metrics, only positive values are expected. "
    if sessions < 0:
        return f"sessions ERROR, Invalid field {path} value = {sessions}, from sessions, only positive values are expected. "
    if sessions == metrics == 0.0:
        return None
    if float(abs(sessions - metrics)) / max(metrics, sessions) > 0.01:
        return f"fields with different values at {path} sessions={sessions}, metrics={metrics}"
    return None


compare_quantiles = compare_ratios


def compare_scalars(
    sessions, metrics, rollup: int, path: str, schema: Optional[ComparatorType]
) -> Optional[str]:
    if schema is None:
        t = type(sessions)
        if t in (str, int):
            return compare_entities(sessions, metrics, path)
        elif t == float:
            return compare_ratios(sessions, metrics, path)
        elif t == datetime:
            return compare_datetime(sessions, metrics, rollup, path)
        else:
            return f"unsupported scalar type {t} at path {path}"
    elif schema == ComparatorType.Ignore:
        return None
    elif schema == ComparatorType.Counter:
        return compare_counters(sessions, metrics, path)
    elif schema == ComparatorType.Ratio:
        return compare_ratios(sessions, metrics, path)
    elif schema == ComparatorType.Quantile:
        return compare_ratios(sessions, metrics, path)
    elif schema == ComparatorType.Entity:
        return compare_entities(sessions, metrics, path)
    elif schema == ComparatorType.DateTime:
        return compare_datetime(sessions, metrics, rollup, path)
    else:
        return f"unsupported schema={schema} at {path}"


def _compare_basic_sequence(sessions, metrics, path: str) -> (bool, List[str]):
    """
    Does basic comparisons common to sequences (arrays and tuples)

    if the first parameter of the tuple is True the comparison is finished and the second
    element can be returned as the final result.
    If the first parameter is False the second parameter is an empty array (no errors found so far) and specialised
    comparison should continue
    """
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        if error is not None:
            return True, [error]
        else:
            return True, []

    if not isinstance(sessions, collections.abc.Sequence) or not isinstance(
        metrics, collections.abc.Sequence
    ):
        return True, [
            f"invalid sequence types at path {path} sessions={type(sessions)}, metrics={type(metrics)}"
        ]
    if len(sessions) != len(metrics):
        return True, [
            f"different length for metrics tuple on path {path}, sessions={len(sessions)}, metrics={len(metrics)}"
        ]
    return False, []


def compare_arrays(
    sessions, metrics, rollup: int, path: str, schema: Optional[List[Schema]]
) -> List[str]:
    done, errors = _compare_basic_sequence(sessions, metrics, path)
    if done:
        return errors

    if schema is None:
        child_schema = None
    else:
        assert len(schema) == 1
        child_schema = schema[0]

    for idx in range(len(sessions)):
        elm_path = f"{path}[{idx}]"
        errors += compare_results(sessions[idx], metrics[idx], rollup, elm_path, child_schema)

    return errors


def compare_tuples(
    sessions, metrics, rollup: int, path: str, schema: Optional[Sequence[Schema]]
) -> List[str]:
    done, errors = _compare_basic_sequence(sessions, metrics, path)
    if done:
        return errors

    if schema is not None:
        assert len(sessions) == len(schema)
    for idx in range(len(sessions)):
        elm_path = f"{path}[{idx}]"
        if schema is None:
            child_schema = None
        else:
            child_schema = schema[idx]
        errors += compare_results(sessions[idx], metrics[idx], rollup, elm_path, child_schema)
    return errors


def compare_sets(sessions, metrics, path: str) -> List[str]:
    if sessions != metrics:
        return [f"different values found at path {path} sessions={sessions}, metrics={metrics}"]
    return []


def compare_dicts(
    sessions: Mapping[Any, Any],
    metrics: Mapping[Any, Any],
    rollup: int,
    path: str,
    schema: Optional[Mapping[str, Schema]],
) -> List[str]:
    if type(metrics) != dict:
        return [
            f"invalid type of metrics at path {path} expecting a dictionary fouond a {type(metrics)}"
        ]

    if schema is None:
        iterate_all = True
        generic_item_schema = None
        schema = {}
    else:
        iterate_all = "*" in schema
        generic_item_schema = schema.get("*")

    ret_val = []

    if iterate_all:
        if len(sessions) != len(metrics):
            return [
                f"different number of keys in dictionaries sessions={len(sessions)}, metrics={len(metrics)}"
            ]
        for key, val in sessions.items():
            child_path = f"{path}[{key}]"
            child_schema = schema.get(key, generic_item_schema)
            ret_val += compare_results(val, metrics.get(key), rollup, child_path, child_schema)
    else:
        for key, child_schema in schema.items():
            child_path = f"{path}[{key}]"
            ret_val += compare_results(
                sessions.get(key), metrics.get(key), rollup, child_path, child_schema
            )
    return ret_val


def compare_results(
    sessions, metrics, rollup: int, path: Optional[str] = None, schema: Optional[Schema] = None
) -> List[str]:
    if path is None:
        path = ""

    if schema is not None:
        discriminator = schema
    else:
        discriminator = sessions

    if discriminator is None:
        if metrics is None:
            return []
        else:
            return [f"unmatched field at path {path}, sessions=None, metrics={metrics}"]

    if type(discriminator) in {str, float, int, datetime, ComparatorType}:
        err = compare_scalars(sessions, metrics, rollup, path, schema)
        if err is not None:
            return [err]
        else:
            return []
    elif type(discriminator) == tuple:
        return compare_tuples(sessions, metrics, rollup, path, schema)
    elif type(discriminator) == list:
        return compare_arrays(sessions, metrics, rollup, path, schema)
    elif type(discriminator) == set:
        return compare_sets(sessions, metrics, path)
    elif type(discriminator) == dict:
        return compare_dicts(sessions, metrics, rollup, path, schema)
    else:
        return [f"invalid schema type={type(schema)} at path:'{path}'"]


class DuplexReleaseHealthBackend(ReleaseHealthBackend):
    DEFAULT_ROLLUP = 60 * 60  # 1h

    def __init__(
        self,
        metrics_start: datetime,
    ):
        self.sessions = SessionsReleaseHealthBackend()
        self.metrics = MetricsReleaseHealthBackend()
        self.metrics_start = metrics_start

    def log_exception(self, ex, result=None):
        pass  # TODO

    def log_errors(self, errors, sessions, metrics):
        pass

    def _dispatch_call(
        self,
        fn_name: str,
        should_compare: Union[bool, Callable[[Any], bool]],
        rollup: int,
        schema: Optional[Schema],
        *args,
    ):
        sessions_fn = getattr(self.sessions, fn_name)
        ret_val = sessions_fn(*args)
        try:
            if type(should_compare) != bool:
                # should compare depends on the session result
                # evaluate it now
                # TODO add timers around sessions and metrics
                should_compare = should_compare(ret_val)
        except Exception as ex:
            should_compare = False
            self.log_exception(ex)

        if should_compare:
            copy = deepcopy(ret_val)
            try:
                metrics_fn = getattr(self.metrics, fn_name)
                metrics_val = metrics_fn(*args)
            except Exception as ex:
                self.log_exception(ex, copy)
            else:
                errors = compare_results(copy, metrics_val, rollup, None, schema)
                self.log_errors(errors, copy, metrics_val)
        return ret_val

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[ProjectId],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: Optional[OrganizationId] = None,
    ) -> CurrentAndPreviousCrashFreeRates:
        schema = {
            "*": {
                "currentCrashFreeRate": ComparatorType.Ratio,
                "previousCrashFreeRate": ComparatorType.Ratio,
            }
        }
        should_compare = previous_start > self.metrics_start
        return self._dispatch_call(
            "get_current_and_previous_crash_free_rates",
            should_compare,
            rollup,
            schema,
            project_ids,
            current_start,
            current_end,
            previous_start,
            previous_end,
            rollup,
            org_id,
        )

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        rollup = self.DEFAULT_ROLLUP  # not used
        schema = {
            "adoption": ComparatorType.Ratio,
            "session_adoption": ComparatorType.Ratio,
            "users_24h": ComparatorType.Counter,
            "project_users_24h": ComparatorType.Counter,
            "project_sessions_24h": ComparatorType.Counter,
        }
        should_compare = datetime.utcnow() - timedelta(hours=24) > self.metrics_start
        return self._dispatch_call(
            "get_release_adoption",
            should_compare,
            rollup,
            schema,
            project_releases,
            environments,
            now,
            org_id,
        )

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        rollup = query.rollup

        schema_for_totals = {
            "sum(session)": ComparatorType.Counter,
            "count_unique(user)": ComparatorType.Counter,
            "avg(session.duration)": ComparatorType.Quantile,
            "p50(session.duration)": ComparatorType.Quantile,
            "p75(session.duration)": ComparatorType.Quantile,
            "p90(session.duration)": ComparatorType.Quantile,
            "p95(session.duration)": ComparatorType.Quantile,
            "p99(session.duration)": ComparatorType.Quantile,
            "max(session.duration)": ComparatorType.Quantile,
        }
        schema_for_series = {field: [comparator] for field, comparator in schema_for_totals.items()}

        schema = {
            "start": ComparatorType.DateTime,
            "end": ComparatorType.DateTime,
            "intervals": [ComparatorType.DateTime],
            "groups": [
                # FIXME: The entries in this list do not necessarily appear in the
                # same order. For this reason, the tests use the `result_sorted` function defined here:
                # https://github.com/getsentry/sentry/blob/0176f2f29849323ce851e4653a8891691e32a83e/tests/snuba/api/endpoints/test_organization_sessions.py#L16-L23
                # Should we define a schema type which supports something like this?
                # UnsortedCollection(sort_by=lambda item: sorted(item["by"].items()))
                {
                    "by": ComparatorType.Entity,
                    "series": schema_for_series,
                    "totals": schema_for_totals,
                }
            ],
            "query": ComparatorType.Entity,
        }

        should_compare = query.start > self.metrics_start

        return self._dispatch_call(
            "run_sessions_query", should_compare, rollup, schema, org_id, query, span_op
        )

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        rollup = self.DEFAULT_ROLLUP  # TODO is this the proper ROLLUP ?
        schema = {
            "sessions_lower_bound": ComparatorType.DateTime,
            "sessions_upper_bound": ComparatorType.DateTime,
        }

        def should_compare(val: ReleaseSessionsTimeBounds):
            lower_bound = val.get("sessions_lower_bound")
            if lower_bound is not None:
                lower_bound = parser.parse(lower_bound)
                return lower_bound > self.metrics_start
            return True

        return self._dispatch_call(
            "get_release_sessions_time_bounds",
            should_compare,
            rollup,
            schema,
            project_id,
            release,
            org_id,
            environments,
        )

    def check_has_health_data(
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        rollup = self.DEFAULT_ROLLUP  # not used
        schema = {ComparatorType.Entity}
        should_compare = datetime.utcnow() - timedelta(days=90) > self.metrics_start
        return self._dispatch_call(
            "check_has_health_data", should_compare, rollup, schema, projects_list
        )

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        rollup = self.DEFAULT_ROLLUP  # not used
        schema = {ComparatorType.Entity}
        should_compare = start > self.metrics_start
        return self._dispatch_call(
            "check_releases_have_health_data",
            should_compare,
            rollup,
            schema,
            organization_id,
            project_ids,
            release_versions,
            start,
            end,
        )

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[Literal["users", "sessions"]] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        rollup = self.DEFAULT_ROLLUP  # not used
        # ignore all fields except the 24h ones (the others go to the beginning of time)
        schema = {
            "total_users_24h": ComparatorType.Counter,
            "total_project_users_24h": ComparatorType.Counter,
            "total_sessions_24h": ComparatorType.Counter,
            "total_project_sessions_24h": ComparatorType.Counter
            # TODO still need to look into stats field and find out what compare conditions it has
        }
        should_compare = datetime.utcnow() - timedelta(days=1) > self.metrics_start
        return self._dispatch_call(
            "get_release_health_data_overview",
            should_compare,
            rollup,
            schema,
            project_releases,
            environments,
            summary_stats_period,
            health_stats_period,
            stat,
        )

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        rollup = self.DEFAULT_ROLLUP  # TODO Check if this is the rollup we want
        schema = [
            {
                "date": ComparatorType.DateTime,
                "total_users": ComparatorType.Counter,
                "crash_free_users": ComparatorType.Ratio,
                "total_sessions": ComparatorType.Counter,
                "crash_free_sessions": ComparatorType.Ratio,
            }
        ]
        should_compare = start > self.metrics_start
        return self._dispatch_call(
            "get_crash_free_breakdown",
            should_compare,
            rollup,
            schema,
            project_id,
            release,
            start,
            environments,
        )

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:
        rollup = self.DEFAULT_ROLLUP  # not used
        schema = [ComparatorType.Entity]
        should_compare = datetime.utcnow() - timedelta(days=3) > self.metrics_start
        return self._dispatch_call(
            "get_changed_project_release_model_adoptions",
            should_compare,
            rollup,
            schema,
            project_ids,
        )

    def get_oldest_health_data_for_releases(
        self, project_releases: Sequence[ProjectRelease]
    ) -> Mapping[ProjectRelease, str]:
        rollup = self.DEFAULT_ROLLUP  # TODO check if this is correct ?
        schema = {"*": ComparatorType.DateTime}
        should_compare = datetime.utcnow() - timedelta(days=90) > self.metrics_start
        return self._dispatch_call(
            "get_oldest_health_data_for_releases", should_compare, rollup, schema, project_releases
        )

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        schema = ComparatorType.Counter

        if stats_period is None:
            stats_period = "24h"

        if scope.endswith("_24h"):
            stats_period = "24h"

        rollup, stats_start, _ = get_rollup_starts_and_buckets(stats_period)
        should_compare = stats_start > self.metrics_start

        return self._dispatch_call(
            "get_project_releases_count",
            should_compare,
            rollup,
            schema,
            organization_id,
            project_ids,
            scope,
            stats_period,
            environments,
        )

    def get_project_release_stats(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        stat: OverviewStat,
        rollup: int,
        start: datetime,
        end: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Union[ProjectReleaseUserStats, ProjectReleaseSessionStats]:
        schema = {
            "duration_p50": ComparatorType.Quantile,
            "duration_p90": ComparatorType.Quantile,
            "*": ComparatorType.Counter,
        }
        should_compare = start > self.metrics_start
        return self._dispatch_call(
            "get_project_release_stats",
            should_compare,
            rollup,
            schema,
            project_id,
            release,
            stat,
            rollup,
            start,
            end,
            environments,
        )

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:
        schema = ComparatorType.Counter
        should_compare = start > self.metrics_start
        return self._dispatch_call(
            "get_project_sessions_count",
            should_compare,
            rollup,
            schema,
            project_id,
            rollup,
            start,
            end,
            environment_id,
        )

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:
        schema = [(ComparatorType.Entity, ComparatorType.Counter)]
        should_compare = start > self.metrics_start
        return self._dispatch_call(
            "get_num_sessions_per_project",
            should_compare,
            rollup,
            schema,
            project_ids,
            start,
            end,
            environment_ids,
            rollup,
        )

    def get_project_releases_by_stability(
        self,
        project_ids: Sequence[ProjectId],
        offset: Optional[int],
        limit: Optional[int],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[str]] = None,
    ) -> Sequence[ProjectRelease]:
        schema = [ComparatorType.Entity]

        if stats_period is None:
            stats_period = "24h"

        if scope.endswith("_24h"):
            stats_period = "24h"

        rollup, stats_start, _ = get_rollup_starts_and_buckets(stats_period)
        should_compare = stats_start > self.metrics_start

        return self._dispatch_call(
            "get_project_releases_by_stability",
            should_compare,
            rollup,
            schema,
            project_ids,
            offset,
            limit,
            scope,
            stats_period,
            environments,
        )
