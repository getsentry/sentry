import inspect
from copy import deepcopy
from datetime import datetime
from typing import Any, List, Mapping, Optional, Sequence, Set, TypeVar, Union

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
from sentry.snuba.sessions_v2 import QueryDefinition

DateLike = TypeVar("DateLike", datetime, str)
Schema = Union[str, List["Schema"], Mapping[str, "Schema"], Set["Schema"]]


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


def compare_datetime(
    sessions: Optional[DateLike], metrics: Optional[DateLike], rollup: int, path: str
) -> Optional[str]:
    if sessions is None and metrics is None:
        return None
    if sessions is None:
        return f"Field {path} only present in metrics implementation"
    if metrics is None:
        return f"Field {path} missing from metrics implementation"
    if type(sessions) != type(metrics):
        return f"Field {path} inconsistent types return sessions={type(sessions)}, metrics={type(metrics)}"
    if type(sessions) == str:
        try:
            sessions_d = parser.parse(sessions)
            metrics_d = parser.parse(metrics)
            dd = abs(sessions_d - metrics_d)
        except parser.ParserError:
            return f"Field {path} could not parse dates sessions={sessions}, metrics={metrics}"
    else:
        dd = abs(sessions - metrics)
    if dd > rollup:
        return f"Field {path} failed to mach datetimes sessions={sessions}, metrics={metrics} "
    return None


def compare_counters(sessions: Optional[int], metrics: Optional[int], path: str) -> Optional[str]:
    """
    Aprox

    >>> compare_counters(100,110, "x.y")
    'Fields with different values at x.y sessions=100, metrics=110'
    >>> compare_counters(100,105, "x.y")
    >>> compare_counters(100,96, "x.y")
    >>> compare_counters(None,None, "x.y")
    >>> compare_counters(None,1, "x.y")
    'Field x.y only present in metrics implementation'
    >>> compare_counters(0,None, "x.y")
    'Field x.y missing from metrics implementation'
    >>> compare_counters(1,3, "x.y")
    >>> compare_counters(1,7, "x.y")
    'Fields with different values at x.y sessions=1, metrics=7'
    """
    if sessions is None and metrics is None:
        return None
    if sessions is None:
        return f"Field {path} only present in metrics implementation"
    if metrics is None:
        return f"Field {path} missing from metrics implementation"
    if metrics < 0:
        return f"Invalid field {path} value={metrics}, from metrics, only positive values are expected. "
    if sessions < 0:
        return f"Sessions ERROR, Invalid field {path} value = {sessions}, from sessions, only positive values are expected. "
    if (sessions <= 10 and metrics > 10) or (metrics <= 10 and sessions > 10):
        if abs(sessions - metrics) > 4:
            return f"Fields with different values at {path} sessions={sessions}, metrics={metrics}"
        else:
            return None
    if metrics <= 10:
        if abs(sessions - metrics) > 3:
            return f"Fields with different values at {path} sessions={sessions}, metrics={metrics}"
        else:
            return None
    else:
        if float(abs(sessions - metrics)) / metrics > 0.05:
            return f"Fields with different values at {path} sessions={sessions}, metrics={metrics}"
    return None


def compare_ratios(sessions: Optional[float], metrics: Optional[float], path: str) -> Optional[str]:
    if sessions is None and metrics is None:
        return None
    if sessions is None:
        return f"Field {path} only present in metrics implementation"
    if metrics is None:
        return f"Field {path} missing from metrics implementation"
    if metrics < 0:
        return f"Invalid field {path} value = {metrics}, from metrics, only positive values are expected. "
    if sessions < 0:
        return f"Sessions ERROR, Invalid field {path} value = {sessions}, from sessions, only positive values are expected. "
    if sessions == metrics == 0.0:
        return None
    if float(abs(sessions - metrics)) / max(metrics, sessions) > 0.01:
        return f"Fields with different values at {path} sessions={sessions}, metrics={metrics}"
    return None


compare_quantiles = compare_ratios


def compare_scalars(
    sessions, metrics, rollup: int, path: str, schema: Optional[str]
) -> Optional[str]:
    if schema is None:
        if type(sessions) in (str, int):
            return compare_entities(sessions, metrics, path)
        if type(sessions) == float:
            return compare_ratios(sessions, metrics, path)
        if type(sessions) == datetime:
            return compare_datetime(sessions, metrics, rollup, path)
    elif schema in ("counter", "c"):
        return compare_counters(sessions, metrics, path)
    elif schema in ("ratio", "r"):
        return compare_ratios(sessions, metrics, path)
    elif schema in ("quantile", "percentile", "q", "p"):
        return compare_ratios(sessions, metrics, path)
    elif schema == ("entity", "e"):
        return compare_entities(sessions, metrics, path)
    elif schema == ("datetime", "date", "d"):
        return compare_datetime(sessions, metrics, rollup, path)


def compare_arrays(
    sessions, metrics, rollup: int, path: str, schema: Optional[List[Schema]]
) -> List[str]:
    if schema is None:
        child_schema = None
    else:
        assert len(schema) == 1
        child_schema = schema[0]

    ret_val = []

    for idx in range(len(sessions)):
        elm_path = f"{path}[{idx}]"
        ret_val += compare_results(sessions[idx], metrics[idx], rollup, elm_path, child_schema)

    return ret_val


def compare_tuple(
    sessions, metrics, rollup: int, path: str, schema: Optional[Sequence[Schema]]
) -> List[str]:
    if type(sessions) != tuple or type(metrics) != tuple:
        return [
            f"Different length for metrics tuple on path {path}, sessions={len(sessions)}, metrics={len(metrics)}"
        ]

    ret_val = []
    if schema is not None:
        assert len(sessions) == len(schema)
    for idx in range(len(sessions)):
        elm_path = f"{path}[{idx}]"
        if schema is None:
            child_schema = None
        else:
            child_schema = schema[idx]
        ret_val += compare_results(sessions[idx], metrics[idx], rollup, elm_path, child_schema)

    return ret_val


def compare_sets(sessions, metrics, path: str) -> List[str]:
    if sessions != metrics:
        return [f"Different values found at path {path} sessions={sessions}, metrics={metrics}"]
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
            f"Invalid type of metrics at path {path} expecting a dictionary fouond a {type(metrics)}"
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
                f"Different number of keys in dictionaries sessions={len(sessions)}, metrics={len(metrics)}"
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


def compare_results(
    sessions, metrics, rollup: int, path: Optional[str] = None, schema: Optional[Schema] = None
) -> List[str]:
    if path is None:
        path = ""

    errors = []

    if schema is not None:
        discriminator = schema
    else:
        discriminator = sessions

    if discriminator is None:
        if metrics is None:
            return []
        else:
            return [f"Unmatched field at path {path}, sessions=None, metrics={metrics}"]

    if type(discriminator) in {str, float, int, datetime}:
        err = compare_scalars(sessions, metrics, rollup, path, schema)
        if err is not None:
            errors.append(err)
    elif type(discriminator) == tuple:
        return compare_tuple(sessions, metrics, rollup, path, schema)
    elif type(discriminator) == list:
        return compare_arrays(sessions, metrics, rollup, path, schema)
    elif type(discriminator) == set:
        return compare_sets(sessions, metrics, path)
    elif type(discriminator) == dict:
        return compare_dicts(sessions, metrics, rollup, path, schema)
    else:
        return [f"Invalid schema type={type(schema)} at path:'{path}'"]


def log_exception(ex, result):
    pass


class DuplexReleaseHealthBackend(ReleaseHealthBackend):
    def __init__(
        self,
        session: SessionsReleaseHealthBackend,
        metrics: MetricsReleaseHealthBackend,
        metrics_start: datetime,
    ):
        self.session = session
        self.metrics = metrics
        self.metrics_start = metrics_start

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

        ret_val = self.session.get_current_and_previous_crash_free_rates(
            project_ids, current_start, current_end, previous_start, previous_end, rollup, org_id
        )

        if previous_start > self.metrics_start:
            copy = deepcopy(ret_val)
            try:
                metrics_val = self.metrics.get_current_and_previous_crash_free_rates(
                    project_ids,
                    current_start,
                    current_end,
                    previous_start,
                    previous_end,
                    rollup,
                    org_id,
                )
            except Exception as ex:
                log_exception(ex, copy)
            else:
                compare_results(copy, metrics_val)
        return ret_val

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        ret_val = self.session.get_release_adoption(project_releases, environments, now, org_id)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_adoption(
                project_releases, environments, now, org_id
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        ret_val = self.session.run_sessions_query(org_id, query, span_op)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.run_sessions_query(org_id, query, span_op)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        ret_val = self.session.get_release_sessions_time_bounds(
            project_id, release, org_id, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_sessions_time_bounds(
                project_id, release, org_id, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def check_has_health_data(
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        ret_val = self.session.check_has_health_data(projects_list)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.check_has_health_data(projects_list)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        ret_val = self.session.check_releases_have_health_data(
            organization_id, project_ids, release_versions, start, end
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.check_releases_have_health_data(
                organization_id, project_ids, release_versions, start, end
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[Literal["users", "sessions"]] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        ret_val = self.session.get_release_health_data_overview(
            project_releases, environments, summary_stats_period, health_stats_period, stat
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_release_health_data_overview(
                project_releases, environments, summary_stats_period, health_stats_period, stat
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        ret_val = self.session.get_crash_free_breakdown(project_id, release, start, environments)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_crash_free_breakdown(
                project_id, release, start, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:
        ret_val = self.session.get_changed_project_release_model_adoptions(project_ids)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_changed_project_release_model_adoptions(project_ids)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_oldest_health_data_for_releases(
        self, project_releases: Sequence[ProjectRelease]
    ) -> Mapping[ProjectRelease, str]:
        ret_val = self.session.get_oldest_health_data_for_releases(project_releases)
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_oldest_health_data_for_releases(project_releases)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        ret_val = self.session.get_project_releases_count(
            organization_id, project_ids, scope, stats_period, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_releases_count(
                organization_id, project_ids, scope, stats_period, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

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
        raise NotImplementedError()

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:
        ret_val = self.session.get_project_sessions_count(
            project_id, rollup, start, end, environment_id
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_sessions_count(
                project_id, rollup, start, end, environment_id
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:
        ret_val = self.session.get_num_sessions_per_project(
            project_ids, start, end, environment_ids, rollup
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_num_sessions_per_project(
                project_ids, start, end, environment_ids, rollup
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val

    def get_project_releases_by_stability(
        self,
        project_ids: Sequence[ProjectId],
        offset: Optional[int],
        limit: Optional[int],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[str]] = None,
    ) -> Sequence[ProjectRelease]:
        ret_val = self.session.get_project_releases_by_stability(
            project_ids, offset, limit, scope, stats_period, environments
        )
        copy = deepcopy(ret_val)
        try:
            metrics_val = self.metrics.get_project_releases_by_stability(
                project_ids, offset, limit, scope, stats_period, environments
            )
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(copy, metrics_val)
        return ret_val


# TESTING how we cold do it automatically
import types


def generate_method(name):
    def meth(self, *args, **kwargs):
        session_meth = SessionsReleaseHealthBackend.__dict__[name]
        ret_val = session_meth(self.session, *args, **kwargs)
        copy = deepcopy(ret_val)
        try:
            metrics_meth = MetricsReleaseHealthBackend.__dict__[name]
            metrics_ret_val = metrics_meth(self.metrics, *args, **kwargs)
        except Exception as ex:
            log_exception(ex, copy)
        else:
            compare_results(ret_val, metrics_ret_val)
        return ret_val

    return meth


def create_methods(cls):
    def __init__(self, session: SessionsReleaseHealthBackend, metrics: MetricsReleaseHealthBackend):
        self.session = session
        self.metrics = metrics

    cls["__init__"] = __init__
    for name, field in ReleaseHealthBackend.__dict__.items():
        if isinstance(field, types.FunctionType):
            cls[name] = generate_method(name)


AutoDuplex = types.new_class("AutoDup", (ReleaseHealthBackend,), exec_body=create_methods)
