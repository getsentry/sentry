import collections.abc
import math
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    List,
    Mapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
    cast,
)

import pytz
from dateutil import parser
from sentry_sdk import capture_exception, capture_message, push_scope, set_context, set_tag
from typing_extensions import Literal

from sentry import features
from sentry.models import Organization, Project
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
from sentry.utils.metrics import incr, timer

DateLike = Union[datetime, str]

ReleaseHealthResult = Any
Scalars = Union[int, str, float, datetime, None]


def _coerce_utc(timestamp: datetime) -> datetime:
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=pytz.utc)
    return timestamp


class ComparatorType(Enum):
    Counter = "counter"
    Ratio = "ratio"
    Quantile = "quantile"
    Exact = "exact"
    DateTime = "datetime"
    Ignore = "ignore"


IndexBy = Union[str, Callable[[Any], Any]]


class ListSet:
    """
    ListSet is a list that behaves like a set

    Each element has a field (or there is a lambda) that gives its identity
    and elements within two lists are compared for equality by first matching
    the identity and then matching their contents.

    Inserting multiple elements with the same identity will result in
    undefined behaviour (the last element for an identity in the list will
    be compared and all the rest will be ignored)
    """

    def __init__(self, schema: "Schema", index_by: IndexBy):
        self.child_schema = schema
        if type(index_by) == str:
            self.index_by: Callable[[Any], Any] = lambda x: x.get(index_by)
        else:

            self.index_by = cast(Callable[[Any], Any], index_by)


Schema = Union[ComparatorType, List[Any], Mapping[str, Any], Set[Any], ListSet, Tuple[Any, ...]]


def compare_entities(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> Optional[str]:
    if sessions != metrics:
        return f"field {path} contains different data sessions={sessions} metrics={metrics}"
    return None


def _compare_basic(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> Tuple[bool, Optional[str]]:
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
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, rollup: int, path: str
) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if not isinstance(sessions, (str, datetime)):
        return f"invalid field type {path} sessions={sessions} expected a date-like type found {type(sessions)}"

    if not isinstance(metrics, (str, datetime)):
        return f"invalid field type {path} metrics={metrics} expected a date-like type found {type(metrics)}"

    if type(sessions) != type(metrics):
        return f"field {path} inconsistent types return sessions={type(sessions)}, metrics={type(metrics)}"

    dd = None
    if isinstance(sessions, str):
        assert isinstance(metrics, str)
        try:
            sessions_d = parser.parse(sessions)
            metrics_d = parser.parse(metrics)
            dd = abs(sessions_d - metrics_d)
        except parser.ParserError:
            return f"field {path} could not parse dates sessions={sessions}, metrics={metrics}"
    elif isinstance(sessions, datetime):
        assert isinstance(metrics, datetime)
        dd = abs(sessions - metrics)
    if dd != timedelta(seconds=0):
        return f"field {path} failed to match datetimes sessions={sessions}, metrics={metrics}"

    return None


def compare_counters(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if not isinstance(sessions, int):
        return f"invalid field type {path} sessions={sessions} expected an int type found {type(sessions)}"

    if not isinstance(metrics, int):
        return f"invalid field type {path} metrics={metrics} expected an int type found {type(metrics)}"

    if metrics < 0:
        return f"invalid field {path} value={metrics}, from metrics, only positive values are expected. "
    if sessions < 0:
        return f"sessions ERROR, Invalid field {path} value = {sessions}, from sessions, only positive values are expected. "
    if sessions != metrics:
        return f"fields with different values at {path} sessions={sessions}, metrics={metrics}"
    return None


def compare_ratios(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> Optional[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        return error

    if not isinstance(sessions, float):
        return f"invalid field type {path} sessions={sessions} expected a float type found {type(sessions)}"

    if not isinstance(metrics, float):
        return f"invalid field type {path} metrics={metrics} expected a float type found {type(metrics)}"

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
    sessions: Scalars, metrics: Scalars, rollup: int, path: str, schema: Optional[Schema]
) -> Optional[str]:
    if schema is None:
        t = type(sessions)
        if isinstance(sessions, (str, int)):
            return compare_entities(sessions, metrics, path)
        elif isinstance(sessions, float):
            return compare_ratios(sessions, metrics, path)
        elif isinstance(sessions, datetime):
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
    elif schema == ComparatorType.Exact:
        return compare_entities(sessions, metrics, path)
    elif schema == ComparatorType.DateTime:
        return compare_datetime(sessions, metrics, rollup, path)
    else:
        return f"unsupported schema={schema} at {path}"


def _compare_basic_sequence(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> Tuple[bool, List[str]]:
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
    sessions: ReleaseHealthResult,
    metrics: ReleaseHealthResult,
    rollup: int,
    path: str,
    schema: Optional[List[Schema]],
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
    sessions: ReleaseHealthResult,
    metrics: ReleaseHealthResult,
    rollup: int,
    path: str,
    schema: Optional[Sequence[Schema]],
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


def compare_sets(
    sessions: ReleaseHealthResult, metrics: ReleaseHealthResult, path: str
) -> List[str]:
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
            f"invalid type of metrics at path {path} expecting a dictionary found a {type(metrics)}"
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


def compare_list_set(
    sessions: ReleaseHealthResult,
    metrics: ReleaseHealthResult,
    rollup: int,
    path: str,
    schema: ListSet,
) -> List[str]:
    done, error = _compare_basic(sessions, metrics, path)
    if done:
        if error is not None:
            return [error]
        else:
            return []

    sessions_dict = {schema.index_by(x): x for x in sessions}
    metrics_dict = {schema.index_by(x): x for x in metrics}

    return compare_dicts(
        sessions_dict, metrics_dict, rollup, path + "@", {"*": schema.child_schema}
    )


def compare_results(
    sessions: ReleaseHealthResult,
    metrics: ReleaseHealthResult,
    rollup: int,
    path: Optional[str] = None,
    schema: Optional[Schema] = None,
) -> List[str]:
    if path is None:
        path = ""

    if schema is not None:
        discriminator: Union[ReleaseHealthResult, Schema, None] = schema
    else:
        discriminator = sessions

    if discriminator is None:
        if metrics is None:
            return []
        else:
            return [f"unmatched field at path {path}, sessions=None, metrics={metrics}"]

    if isinstance(discriminator, (str, float, int, datetime, ComparatorType)):
        err = compare_scalars(sessions, metrics, rollup, path, schema)
        if err is not None:
            return [err]
        else:
            return []
    elif isinstance(schema, ListSet):  # we only support ListSet in Schemas (not in the results)
        return compare_list_set(sessions, metrics, rollup, path, schema)
    elif isinstance(discriminator, tuple):
        assert schema is None or isinstance(schema, tuple)
        return compare_tuples(sessions, metrics, rollup, path, schema)
    elif isinstance(discriminator, list):
        assert schema is None or isinstance(schema, list)
        return compare_arrays(sessions, metrics, rollup, path, schema)
    elif isinstance(discriminator, set):
        return compare_sets(sessions, metrics, path)
    elif isinstance(discriminator, dict):
        assert schema is None or isinstance(schema, dict)
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
        self.metrics_start = max(
            metrics_start,
            # The sessions backend never returns data beyond 90 days, so any
            # query beyond 90 days will return truncated results.
            # We assume that the release health duplex backend is sufficiently
            # often reinstantiated, at least once per day, not only due to
            # deploys but also because uwsgi/celery are routinely restarting
            # processes
            datetime.now(timezone.utc) - timedelta(days=89),
        )

    @staticmethod
    def _org_from_projects(projects_list: Sequence[ProjectOrRelease]) -> Optional[Organization]:
        if len(projects_list) == 0:
            return None

        projects_list = list(projects_list)
        if isinstance(projects_list[0], tuple):
            project_ids: List[ProjectId] = [x[0] for x in projects_list]
        else:
            project_ids = projects_list

        projects = Project.objects.get_many_from_cache(project_ids)

        if len(projects) > 0:
            return Organization.objects.get_from_cache(id=projects[0].organization_id)
        return None

    @staticmethod
    def _org_from_id(org_id: OrganizationId) -> Organization:
        return Organization.objects.get_from_cache(id=org_id)

    def _dispatch_call_inner(
        self,
        fn_name: str,
        should_compare: Union[bool, Callable[[Any], bool]],
        rollup: Optional[int],
        organization: Optional[Organization],
        schema: Optional[Schema],
        *args: Any,
    ) -> ReleaseHealthResult:
        if rollup is None:
            rollup = 0  # force exact date comparison if not specified

        sessions_fn = getattr(self.sessions, fn_name)
        set_tag("releasehealth.duplex.rollup", str(rollup))
        set_tag("releasehealth.duplex.method", fn_name)
        set_tag("releasehealth.duplex.org_id", str(getattr(organization, "id")))

        tags = {"method": fn_name, "rollup": str(rollup)}
        with timer("releasehealth.sessions.duration", tags=tags, sample_rate=1.0):
            ret_val = sessions_fn(*args)

        if organization is None or not features.has(
            "organizations:release-health-check-metrics", organization
        ):
            return ret_val  # cannot check feature without organization

        set_context(
            "release-health-duplex-sessions",
            {
                "sessions": ret_val,
            },
        )

        try:
            if not isinstance(should_compare, bool):
                # should compare depends on the session result
                # evaluate it now
                should_compare = should_compare(ret_val)

            incr(
                "releasehealth.metrics.check_should_compare",
                tags={"should_compare": str(should_compare), **tags},
                sample_rate=1.0,
            )

            if not should_compare:
                return ret_val

            copy = deepcopy(ret_val)

            metrics_fn = getattr(self.metrics, fn_name)
            with timer("releasehealth.metrics.duration", tags=tags, sample_rate=1.0):
                metrics_val = metrics_fn(*args)

            set_context("release-health-duplex-metrics", {"metrics": metrics_val})

            with timer("releasehealth.results-diff.duration", tags=tags, sample_rate=1.0):
                errors = compare_results(copy, metrics_val, rollup, None, schema)

            set_context("release-health-duplex-errors", {"errors": errors})

            incr(
                "releasehealth.metrics.compare",
                tags={"has_errors": str(bool(errors)), **tags},
                sample_rate=1.0,
            )
            if errors and features.has(
                "organizations:release-health-check-metrics-report", organization
            ):
                # We heavily rely on Sentry's message sanitization to properly deduplicate this
                capture_message(f"{fn_name} - Release health metrics mismatch: {errors[0]}")
        except Exception:
            capture_exception()
            should_compare = False
            incr(
                "releasehealth.metrics.crashed",
                tags=tags,
                sample_rate=1.0,
            )

        return ret_val

    if TYPE_CHECKING:
        # Mypy is not smart enough to figure out _dispatch_call is a wrapper
        # around _dispatch_call_inner with the same exact signature, and I am
        # pretty sure there is no sensible way to tell it something like that
        # without duplicating the entire signature.
        _dispatch_call = _dispatch_call_inner
    else:

        def _dispatch_call(self, *args, **kwargs):
            with push_scope():
                return self._dispatch_call_inner(*args, **kwargs)

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
        should_compare = lambda _: _coerce_utc(previous_start) > self.metrics_start

        if org_id is not None:
            organization = self._org_from_id(org_id)
        else:
            organization = self._org_from_projects(project_ids)

        return self._dispatch_call(  # type: ignore
            "get_current_and_previous_crash_free_rates",
            should_compare,
            rollup,
            organization,
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

        if now is None:
            now = datetime.now(pytz.utc)

        should_compare = lambda _: now - timedelta(hours=24) > self.metrics_start

        if org_id is not None:
            organization = self._org_from_id(org_id)
        else:
            organization = self._org_from_projects(project_releases)

        return self._dispatch_call(  # type: ignore
            "get_release_adoption",
            should_compare,
            rollup,
            organization,
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

        # Tag sentry event with relative end time, so we can see if live queries
        # cause greater deltas:
        relative_hours = math.ceil((query.end - datetime.now(timezone.utc)).total_seconds() / 3600)
        set_tag("run_sessions_query.rel_end", f"{relative_hours}h")

        def index_by(d: Mapping[Any, Any]) -> Any:
            return tuple(sorted(d["by"].items(), key=lambda t: t[0]))  # type: ignore

        schema = {
            "start": ComparatorType.DateTime,
            "end": ComparatorType.DateTime,
            "intervals": [ComparatorType.DateTime],
            "groups": ListSet(
                schema={
                    "by": ComparatorType.Ignore,
                    "series": schema_for_series,
                    "totals": schema_for_totals,
                },
                index_by=index_by,
            ),
            "query": ComparatorType.Exact,
        }

        should_compare = lambda _: _coerce_utc(query.start) > self.metrics_start

        organization = self._org_from_id(org_id)
        return self._dispatch_call(  # type: ignore
            "run_sessions_query",
            should_compare,
            rollup,
            organization,
            schema,
            org_id,
            query,
            span_op,
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

        def should_compare(val: ReleaseSessionsTimeBounds) -> bool:
            lower_bound = val.get("sessions_lower_bound")
            if lower_bound is not None:
                lower_bound_d = parser.parse(lower_bound)
                return lower_bound_d > self.metrics_start
            return True

        organization = self._org_from_id(org_id)

        return self._dispatch_call(  # type: ignore
            "get_release_sessions_time_bounds",
            should_compare,
            rollup,
            organization,
            schema,
            project_id,
            release,
            org_id,
            environments,
        )

    def check_has_health_data(
        self,
        projects_list: Sequence[ProjectOrRelease],
        now: Optional[datetime] = None,
    ) -> Set[ProjectOrRelease]:
        if now is None:
            now = datetime.now(pytz.utc)

        rollup = self.DEFAULT_ROLLUP  # not used
        schema = {ComparatorType.Exact}
        should_compare = lambda _: now - timedelta(days=90) > self.metrics_start
        organization = self._org_from_projects(projects_list)
        return self._dispatch_call(  # type: ignore
            "check_has_health_data",
            should_compare,
            rollup,
            organization,
            schema,
            projects_list,
            now,
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
        schema = {ComparatorType.Exact}
        should_compare = lambda _: _coerce_utc(start) > self.metrics_start

        organization = self._org_from_id(organization_id)

        return self._dispatch_call(  # type: ignore
            "check_releases_have_health_data",
            should_compare,
            rollup,
            organization,
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
        now: Optional[datetime] = None,
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

        if now is None:
            now = datetime.now(pytz.utc)

        should_compare = lambda _: now - timedelta(days=1) > self.metrics_start
        organization = self._org_from_projects(project_releases)
        return self._dispatch_call(  # type: ignore
            "get_release_health_data_overview",
            should_compare,
            rollup,
            organization,
            schema,
            project_releases,
            environments,
            summary_stats_period,
            health_stats_period,
            stat,
            now,
        )

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        if now is None:
            now = datetime.now(pytz.utc)

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
        should_compare = lambda _: _coerce_utc(start) > self.metrics_start
        organization = self._org_from_projects([project_id])
        return self._dispatch_call(  # type: ignore
            "get_crash_free_breakdown",
            should_compare,
            rollup,
            organization,
            schema,
            project_id,
            release,
            start,
            environments,
            now,
        )

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:
        rollup = self.DEFAULT_ROLLUP  # not used
        schema = ListSet(schema=ComparatorType.Exact, index_by=lambda x: x)

        should_compare = (
            lambda _: datetime.now(timezone.utc) - timedelta(days=3) > self.metrics_start
        )

        if now is None:
            now = datetime.now(pytz.utc)

        organization = self._org_from_projects(project_ids)
        return self._dispatch_call(  # type: ignore
            "get_changed_project_release_model_adoptions",
            should_compare,
            rollup,
            organization,
            schema,
            project_ids,
            now,
        )

    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, str]:
        if now is None:
            now = datetime.now(pytz.utc)

        rollup = self.DEFAULT_ROLLUP  # TODO check if this is correct ?
        schema = {"*": ComparatorType.DateTime}
        should_compare = lambda _: now - timedelta(days=90) > self.metrics_start
        organization = self._org_from_projects(project_releases)
        return self._dispatch_call(  # type: ignore
            "get_oldest_health_data_for_releases",
            should_compare,
            rollup,
            organization,
            schema,
            project_releases,
            now,
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
        should_compare = lambda _: _coerce_utc(stats_start) > self.metrics_start

        organization = self._org_from_id(organization_id)

        return self._dispatch_call(  # type: ignore
            "get_project_releases_count",
            should_compare,
            rollup,
            organization,
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
        schema = (
            [
                (
                    ComparatorType.Exact,  # timestamp
                    {
                        "duration_p50": ComparatorType.Quantile,
                        "duration_p90": ComparatorType.Quantile,
                        "*": ComparatorType.Counter,
                    },
                )
            ],
            {
                "*": ComparatorType.Counter,
            },
        )
        should_compare = lambda _: _coerce_utc(start) > self.metrics_start
        organization = self._org_from_projects([project_id])
        return self._dispatch_call(  # type: ignore
            "get_project_release_stats",
            should_compare,
            rollup,
            organization,
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
        should_compare = lambda _: _coerce_utc(start) > self.metrics_start
        organization = self._org_from_projects([project_id])
        return self._dispatch_call(  # type: ignore
            "get_project_sessions_count",
            should_compare,
            rollup,
            organization,
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
        schema = [(ComparatorType.Exact, ComparatorType.Counter)]
        should_compare = lambda _: _coerce_utc(start) > self.metrics_start
        organization = self._org_from_projects(project_ids)
        return self._dispatch_call(  # type: ignore
            "get_num_sessions_per_project",
            should_compare,
            rollup,
            organization,
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
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:
        schema = ListSet(schema=ComparatorType.Exact, index_by=lambda x: x)

        set_tag("gprbs.limit", str(limit))
        set_tag("gprbs.offset", str(offset))
        set_tag("gprbs.scope", str(scope))

        if stats_period is None:
            stats_period = "24h"

        if scope.endswith("_24h"):
            stats_period = "24h"

        if now is None:
            now = datetime.now(pytz.utc)

        rollup, stats_start, _ = get_rollup_starts_and_buckets(stats_period, now=now)
        should_compare = lambda _: now > self.metrics_start
        organization = self._org_from_projects(project_ids)

        return self._dispatch_call(  # type: ignore
            "get_project_releases_by_stability",
            should_compare,
            rollup,
            organization,
            schema,
            project_ids,
            offset,
            limit,
            scope,
            stats_period,
            environments,
        )
