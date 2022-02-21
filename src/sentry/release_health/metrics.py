import itertools
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from operator import itemgetter
from typing import (
    Any,
    Callable,
    DefaultDict,
    Dict,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Set,
    Tuple,
    TypeVar,
    Union,
)

import pytz
from snuba_sdk import Column, Condition, Direction, Entity, Function, Op, OrderBy, Query
from snuba_sdk.expressions import Expression, Granularity, Limit, Offset
from snuba_sdk.query import SelectableExpression

from sentry.models import Environment
from sentry.models.project import Project
from sentry.release_health.base import (
    CrashFreeBreakdown,
    CurrentAndPreviousCrashFreeRates,
    DurationPercentiles,
    EnvironmentName,
    OrganizationId,
    OverviewStat,
    ProjectId,
    ProjectOrRelease,
    ProjectRelease,
    ProjectReleaseSessionStats,
    ProjectReleaseUserStats,
    ProjectWithCount,
    ReleaseAdoption,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionCounts,
    SessionsQueryResult,
    StatsPeriod,
    UserCounts,
)
from sentry.release_health.metrics_sessions_v2 import run_sessions_query
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.sessions import SessionMetricKey as MetricKey
from sentry.sentry_metrics.utils import (
    MetricIndexNotFound,
    resolve,
    resolve_many_weak,
    resolve_tag_key,
    resolve_weak,
    reverse_resolve,
)
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.snuba.sessions import _make_stats, get_rollup_starts_and_buckets, parse_snuba_datetime
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.snuba import QueryOutsideRetentionError, raw_snql_query

SMALLEST_METRICS_BUCKET = 10

# Whenever a snuba query agains the old sessions table is done without both 1)
# an explicit rollup 2) a groupby some timestamp/bucket, Snuba will pick a
# default rollup of 3600 and pick sessions_hourly_dist over sessions_raw_dist,
# regardless of the timerange chosen.
#
# In order to make functional comparison easier, the metrics implementation
# (explicitly) chooses the same rollup in the equivalent queries, and uses this
# constant to denote that case.
LEGACY_SESSIONS_DEFAULT_ROLLUP = 3600


logger = logging.getLogger(__name__)


_K1 = TypeVar("_K1")
_K2 = TypeVar("_K2")
_V = TypeVar("_V")


def filter_projects_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(Column("project_id"), Op.IN, list(x for x, _ in project_releases))


def filter_releases_by_project_release(
    org_id: int, project_releases: Sequence[ProjectRelease]
) -> Condition:
    return Condition(
        Column(resolve_tag_key("release")),
        Op.IN,
        resolve_many_weak([x for _, x in project_releases]),
    )


def _model_environment_ids_to_environment_names(
    environment_ids: Sequence[int],
) -> Mapping[int, Optional[str]]:
    """
    Maps Environment Model ids to the environment name
    Note: this does a Db lookup
    """
    empty_string_to_none: Callable[[Any], Optional[Any]] = lambda v: None if v == "" else v
    id_to_name: Mapping[int, Optional[str]] = {
        k: empty_string_to_none(v)
        for k, v in Environment.objects.filter(id__in=environment_ids).values_list("id", "name")
    }
    return defaultdict(lambda: None, id_to_name)


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """Gets release health results from the metrics dataset"""

    def is_metrics_based(self) -> bool:
        return True

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[int],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: Optional[int] = None,
    ) -> CurrentAndPreviousCrashFreeRates:
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        projects_crash_free_rate_dict: CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }
        previous = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            previous_start,
            previous_end,
            rollup,
        )

        for project_id, project_data in previous.items():
            projects_crash_free_rate_dict[project_id][
                "previousCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        current = self._get_crash_free_rate_data(
            org_id,
            project_ids,
            current_start,
            current_end,
            rollup,
        )

        for project_id, project_data in current.items():
            projects_crash_free_rate_dict[project_id][
                "currentCrashFreeRate"
            ] = self._compute_crash_free_rate(project_data)

        return projects_crash_free_rate_dict

    @staticmethod
    def _get_org_id(project_ids: Sequence[int]) -> int:
        projects = Project.objects.get_many_from_cache(project_ids)
        org_ids: Set[int] = {project.organization_id for project in projects}
        if len(org_ids) != 1:
            raise ValueError("Expected projects to be from the same organization")

        return org_ids.pop()

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        project_ids: Sequence[int],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> Dict[int, Dict[str, float]]:

        data: Dict[int, Dict[str, float]] = {}

        session_status = resolve_tag_key("session.status")

        count_query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=[Function("sum", [Column("value")], "value")],
            where=[
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[
                Column("project_id"),
                Column(session_status),
            ],
            granularity=Granularity(rollup),
        )

        count_data = raw_snql_query(
            count_query, referrer="release_health.metrics.get_crash_free_data", use_cache=False
        )["data"]

        for row in count_data:
            project_data = data.setdefault(row["project_id"], {})
            tag_value = reverse_resolve(row[session_status])
            project_data[tag_value] = row["value"]

        return data

    @staticmethod
    def _compute_crash_free_rate(data: Dict[str, float]) -> Optional[float]:
        total_session_count = data.get("init", 0)
        crash_count = data.get("crashed", 0)

        if total_session_count == 0:
            return None

        crash_free_rate = 1.0 - (crash_count / total_session_count)

        # If crash count is larger than total session count for some reason
        crash_free_rate = 100 * max(0.0, crash_free_rate)

        return crash_free_rate

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        project_ids = list({x[0] for x in project_releases})
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        if now is None:
            now = datetime.now(pytz.utc)

        return self._get_release_adoption_impl(now, org_id, project_releases, environments)

    @staticmethod
    def _get_release_adoption_impl(
        now: datetime,
        org_id: int,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleasesAdoption:
        start = now - timedelta(days=1)

        def _get_common_where(total: bool) -> List[Condition]:
            where_common: List[Condition] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                filter_projects_by_project_release(project_releases),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, now),
                Condition(Column(resolve_tag_key("session.status")), Op.EQ, resolve_weak("init")),
            ]

            if environments is not None:
                where_common.append(
                    Condition(
                        Column(resolve_tag_key("environment")),
                        Op.IN,
                        resolve_many_weak(environments),
                    )
                )

            if not total:
                where_common.append(filter_releases_by_project_release(org_id, project_releases))

            return where_common

        def _get_common_groupby(total: bool) -> List[SelectableExpression]:
            if total:
                return [Column("project_id")]
            else:
                return [Column("project_id"), Column(resolve_tag_key("release"))]

        def _convert_results(data: Any, total: bool) -> Dict[Any, int]:
            if total:
                return {x["project_id"]: x["value"] for x in data}
            else:
                release_tag = resolve_tag_key("release")
                return {(x["project_id"], x[release_tag]): x["value"] for x in data}

        def _count_sessions(total: bool, referrer: str) -> Dict[Any, int]:
            query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsCounters.value),
                select=[Function("sum", [Column("value")], "value")],
                where=_get_common_where(total)
                + [
                    Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
                ],
                groupby=_get_common_groupby(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )

            return _convert_results(
                raw_snql_query(
                    query,
                    referrer=referrer,
                    use_cache=False,
                )["data"],
                total=total,
            )

        def _count_users(total: bool, referrer: str) -> Dict[Any, int]:
            query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsSets.value),
                select=[Function("uniq", [Column("value")], "value")],
                where=_get_common_where(total)
                + [
                    Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value)),
                ],
                groupby=_get_common_groupby(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )

            return _convert_results(
                raw_snql_query(
                    query,
                    referrer=referrer,
                    use_cache=False,
                )["data"],
                total=total,
            )

        # XXX(markus): Four queries are quite horrible for this... the old code
        # sufficed with two. From what I understand, ClickHouse would have to
        # gain a function uniqCombined64MergeIf, i.e. a conditional variant of
        # what we already use.
        #
        # Alternatively we may want to use a threadpool here to send the
        # queries in parallel.

        # NOTE: referrers are spelled out as single static string literal so
        # S&S folks can search for it more easily. No string formatting
        # business please!

        # Count of sessions/users for given list of environments and timerange, per-project
        sessions_per_project: Dict[int, int] = _count_sessions(
            total=True, referrer="release_health.metrics.get_release_adoption.total_sessions"
        )
        users_per_project: Dict[int, int] = _count_users(
            total=True, referrer="release_health.metrics.get_release_adoption.total_users"
        )

        # Count of sessions/users for given list of environments and timerange AND GIVEN RELEASES, per-project
        sessions_per_release: Dict[Tuple[int, int], int] = _count_sessions(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_sessions"
        )
        users_per_release: Dict[Tuple[int, int], int] = _count_users(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_users"
        )

        rv = {}

        for project_id, release in project_releases:
            release_tag_value = indexer.resolve(release)
            if release_tag_value is None:
                # Don't emit empty releases -- for exact compatibility with
                # sessions table backend.
                continue

            release_sessions = sessions_per_release.get((project_id, release_tag_value))
            release_users = users_per_release.get((project_id, release_tag_value))

            total_sessions = sessions_per_project.get(project_id)
            total_users = users_per_project.get(project_id)

            adoption: ReleaseAdoption = {
                "adoption": float(release_users) / total_users * 100
                if release_users and total_users
                else None,
                "sessions_adoption": float(release_sessions) / total_sessions * 100
                if release_sessions and total_sessions
                else None,
                "users_24h": release_users,
                "sessions_24h": release_sessions,
                "project_users_24h": total_users,
                "project_sessions_24h": total_sessions,
            }

            rv[project_id, release] = adoption

        return rv

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:

        return run_sessions_query(org_id, query, span_op)

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        select: List[SelectableExpression] = [
            Function("min", [Column("timestamp")], "min"),
            Function("max", [Column("timestamp")], "max"),
        ]

        try:
            where: List[Condition] = [
                Condition(Column("org_id"), Op.EQ, org_id),
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column(resolve_tag_key("release")), Op.EQ, resolve_weak(release)),
                Condition(
                    Column("timestamp"), Op.GTE, datetime(2008, 5, 8)
                ),  # Date of sentry's first commit
                Condition(
                    Column("timestamp"), Op.LT, datetime.now(pytz.utc) + timedelta(seconds=10)
                ),
            ]

            if environments is not None:
                env_filter = resolve_many_weak(environments)
                if not env_filter:
                    raise MetricIndexNotFound()

                where.append(Condition(Column(resolve_tag_key("environment")), Op.IN, env_filter))
        except MetricIndexNotFound:
            # Some filter condition can't be constructed and therefore can't be
            # satisfied.
            #
            # Ignore return type because of https://github.com/python/mypy/issues/8533
            return {"sessions_lower_bound": None, "sessions_upper_bound": None}  # type: ignore

        # XXX(markus): We know that this combination of queries is not fully
        # equivalent to the sessions-table based backend. Example:
        #
        # 1. Session sid=x is started with timestamp started=n
        # 2. Same sid=x is updated with new payload with timestamp started=n - 1
        #
        # Old sessions backend would return [n - 1 ; n - 1] as range.
        # New metrics backend would return [n ; n - 1] as range.
        #
        # We don't yet know if this case is relevant. Session's started
        # timestamp shouldn't really change as session status is updated
        # though.

        try:
            # Take care of initial values for session.started by querying the
            # init counter. This should take care of most cases on its own.
            init_sessions_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsCounters.value),
                select=select,
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
                    Condition(
                        Column(resolve_tag_key("session.status")), Op.EQ, resolve_weak("init")
                    ),
                ],
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )

            rows = raw_snql_query(
                init_sessions_query,
                referrer="release_health.metrics.get_release_sessions_time_bounds.init_sessions",
                use_cache=False,
            )["data"]
        except MetricIndexNotFound:
            rows = []

        try:
            # Take care of potential timestamp updates by looking at the metric
            # for session duration, which is emitted once a session is closed ("terminal state")
            #
            # There is a testcase checked in that tests specifically for a
            # session update that lowers session.started. We don't know if that
            # testcase matters particularly.
            terminal_sessions_query = Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsDistributions.value),
                select=select,
                where=where
                + [
                    Condition(
                        Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION_DURATION.value)
                    ),
                ],
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            )
            rows.extend(
                raw_snql_query(
                    terminal_sessions_query,
                    referrer="release_health.metrics.get_release_sessions_time_bounds.terminal_sessions",
                    use_cache=False,
                )["data"]
            )
        except MetricIndexNotFound:
            pass

        # This check is added because if there are no sessions found, then the
        # aggregations query return both the sessions_lower_bound and the
        # sessions_upper_bound as `0` timestamp and we do not want that behaviour
        # by default
        # P.S. To avoid confusion the `0` timestamp which is '1970-01-01 00:00:00'
        # is rendered as '0000-00-00 00:00:00' in clickhouse shell
        formatted_unix_start_time = datetime.utcfromtimestamp(0).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        lower_bound: Optional[str] = None
        upper_bound: Optional[str] = None

        for row in rows:
            if set(row.values()) == {formatted_unix_start_time}:
                continue
            if lower_bound is None or row["min"] < lower_bound:
                lower_bound = row["min"]
            if upper_bound is None or row["max"] > upper_bound:
                upper_bound = row["max"]

        if lower_bound is None or upper_bound is None:
            return {"sessions_lower_bound": None, "sessions_upper_bound": None}  # type: ignore

        def iso_format_snuba_datetime(date: str) -> str:
            return datetime.strptime(date, "%Y-%m-%dT%H:%M:%S+00:00").isoformat()[:19] + "Z"

        return {  # type: ignore
            "sessions_lower_bound": iso_format_snuba_datetime(lower_bound),
            "sessions_upper_bound": iso_format_snuba_datetime(upper_bound),
        }

    def check_has_health_data(
        self,
        projects_list: Sequence[ProjectOrRelease],
        now: Optional[datetime] = None,
    ) -> Set[ProjectOrRelease]:
        if now is None:
            now = datetime.now(pytz.utc)

        start = now - timedelta(days=3)

        projects_list = list(projects_list)

        if len(projects_list) == 0:
            return set()

        includes_releases = isinstance(projects_list[0], tuple)

        if includes_releases:
            project_ids: List[ProjectId] = [x[0] for x in projects_list]  # type: ignore
        else:
            project_ids = projects_list  # type: ignore

        org_id = self._get_org_id(project_ids)

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        if includes_releases:
            releases = [x[1] for x in projects_list]  # type: ignore
            release_column_name = resolve_tag_key("release")
            releases_ids = resolve_many_weak(releases)
            where_clause.append(Condition(Column(release_column_name), Op.IN, releases_ids))
            column_names = ["project_id", release_column_name]

        else:
            column_names = ["project_id"]

        def extract_row_info_func(
            include_releases: bool,
        ) -> Callable[[Mapping[str, Union[int, str]]], ProjectOrRelease]:
            def f(row: Mapping[str, Union[int, str]]) -> ProjectOrRelease:
                if include_releases:
                    return row["project_id"], reverse_resolve(row.get(release_column_name))  # type: ignore
                else:
                    return row["project_id"]  # type: ignore

            return f

        extract_row_info = extract_row_info_func(includes_releases)

        query_cols = [Column(column_name) for column_name in column_names]
        group_by_clause = query_cols

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=query_cols,
            where=where_clause,
            groupby=group_by_clause,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
        )

        result = raw_snql_query(
            query, referrer="release_health.metrics.check_has_health_data", use_cache=False
        )

        return {extract_row_info(row) for row in result["data"]}

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:

        try:
            metric_id_session = resolve(MetricKey.SESSION.value)
            release_column_name = resolve_tag_key("release")
        except MetricIndexNotFound:
            return set()

        releases_ids = resolve_many_weak(release_versions)
        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=[Column(release_column_name)],
            where=[
                Condition(Column("org_id"), Op.EQ, organization_id),
                Condition(Column("project_id"), Op.IN, project_ids),
                Condition(Column("metric_id"), Op.EQ, metric_id_session),
                Condition(Column(release_column_name), Op.IN, releases_ids),
                Condition(Column("timestamp"), Op.GTE, start),
                Condition(Column("timestamp"), Op.LT, end),
            ],
            groupby=[Column(release_column_name)],
        )

        result = raw_snql_query(
            query,
            referrer="release_health.metrics.check_releases_have_health_data",
            use_cache=False,
        )

        def extract_row_info(row: Mapping[str, Union[OrganizationId, str]]) -> ReleaseName:
            return reverse_resolve(row.get(release_column_name))  # type: ignore

        return {extract_row_info(row) for row in result["data"]}

    @staticmethod
    def _get_session_duration_data_for_overview(
        where: List[Condition],
        org_id: int,
        rollup: int,
    ) -> Mapping[Tuple[int, str], Any]:
        """
        Percentiles of session duration
        """
        rv_durations: Dict[Tuple[int, str], Any] = {}

        release_column_name = resolve_tag_key("release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsDistributions.value),
                select=aggregates
                + [
                    Function(
                        alias="percentiles",
                        function="quantiles(0.5,0.9)",
                        parameters=[Column("value")],
                    )
                ],
                where=where
                + [
                    Condition(
                        Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION_DURATION.value)
                    ),
                    Condition(
                        Column(resolve_tag_key("session.status")),
                        Op.EQ,
                        resolve_weak("exited"),
                    ),
                ],
                groupby=aggregates,
                granularity=Granularity(rollup),
            ),
            referrer="release_health.metrics.get_session_duration_data_for_overview",
        )["data"]:
            # See https://github.com/getsentry/snuba/blob/8680523617e06979427bfa18c6b4b4e8bf86130f/snuba/datasets/entities/metrics.py#L184 for quantiles
            key = (row["project_id"], reverse_resolve(row[release_column_name]))
            rv_durations[key] = {
                "duration_p50": row["percentiles"][0],
                "duration_p90": row["percentiles"][1],
            }

        return rv_durations

    @staticmethod
    def _get_errored_sessions_for_overview(
        where: List[Condition],
        org_id: int,
        rollup: int,
    ) -> Mapping[Tuple[int, str], int]:
        """
        Count of errored sessions, incl fatal (abnormal, crashed) sessions,
        excl errored *preaggregated* sessions
        """
        rv_errored_sessions: Dict[Tuple[int, str], int] = {}

        release_column_name = resolve_tag_key("release")
        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsSets.value),
                select=aggregates + [Function("uniq", [Column("value")], "value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION_ERROR.value)),
                ],
                groupby=aggregates,
                granularity=Granularity(rollup),
            ),
            referrer="release_health.metrics.get_errored_sessions_for_overview",
        )["data"]:
            key = row["project_id"], reverse_resolve(row[release_column_name])
            rv_errored_sessions[key] = row["value"]

        return rv_errored_sessions

    @staticmethod
    def _get_session_by_status_for_overview(
        where: List[Condition], org_id: int, rollup: int
    ) -> Mapping[Tuple[int, str, str], int]:
        """
        Counts of init, abnormal and crashed sessions, purpose-built for overview
        """
        release_column_name = resolve_tag_key("release")
        session_status_column_name = resolve_tag_key("session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        rv_sessions: Dict[Tuple[int, str, str], int] = {}

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsCounters.value),
                select=aggregates + [Function("sum", [Column("value")], "value")],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
                    Condition(
                        Column(session_status_column_name),
                        Op.IN,
                        resolve_many_weak(["abnormal", "crashed", "init", "errored_preaggr"]),
                    ),
                ],
                groupby=aggregates,
                granularity=Granularity(rollup),
            ),
            referrer="release_health.metrics.get_abnormal_and_crashed_sessions_for_overview",
        )["data"]:
            key = (
                row["project_id"],
                reverse_resolve(row[release_column_name]),
                reverse_resolve(row[session_status_column_name]),
            )
            rv_sessions[key] = row["value"]

        return rv_sessions

    @staticmethod
    def _get_users_and_crashed_users_for_overview(
        where: List[Condition], org_id: int, rollup: int
    ) -> Mapping[Tuple[int, str, str], int]:
        release_column_name = resolve_tag_key("release")
        session_status_column_name = resolve_tag_key("session.status")

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column(session_status_column_name),
        ]

        # Count of users and crashed users
        rv_users: Dict[Tuple[int, str, str], int] = {}

        # Avoid mutating input parameters here
        select = aggregates + [Function("uniq", [Column("value")], "value")]
        where = where + [
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value)),
            Condition(
                Column(session_status_column_name),
                Op.IN,
                resolve_many_weak(["crashed", "init"]),
            ),
        ]

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(EntityKey.MetricsSets.value),
                select=select,
                where=where,
                groupby=aggregates,
                granularity=Granularity(rollup),
            ),
            referrer="release_health.metrics.get_users_and_crashed_users_for_overview",
        )["data"]:
            key = (
                row["project_id"],
                reverse_resolve(row[release_column_name]),
                reverse_resolve(row[session_status_column_name]),
            )
            rv_users[key] = row["value"]

        return rv_users

    @staticmethod
    def _get_health_stats_for_overview(
        where: List[Condition],
        org_id: int,
        health_stats_period: StatsPeriod,
        stat: OverviewStat,
        now: datetime,
    ) -> Mapping[ProjectRelease, List[List[int]]]:
        release_column_name = resolve_tag_key("release")
        session_status_column_name = resolve_tag_key("session.status")
        session_init_tag_value = resolve_weak("init")

        stats_rollup, stats_start, stats_buckets = get_rollup_starts_and_buckets(
            health_stats_period, now=now
        )

        aggregates: List[SelectableExpression] = [
            Column(release_column_name),
            Column("project_id"),
            Column("bucketed_time"),
        ]

        rv: Dict[ProjectRelease, List[List[int]]] = defaultdict(lambda: _make_stats(stats_start, stats_rollup, stats_buckets))  # type: ignore

        entity = {
            "users": EntityKey.MetricsSets.value,
            "sessions": EntityKey.MetricsCounters.value,
        }[stat]

        value_column = {
            "users": Function("uniq", [Column("value")], "value"),
            "sessions": Function("sum", [Column("value")], "value"),
        }[stat]

        metric_name = resolve({"sessions": MetricKey.SESSION, "users": MetricKey.USER}[stat].value)

        for row in raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                match=Entity(entity),
                select=aggregates + [value_column],
                where=where
                + [
                    Condition(Column("metric_id"), Op.EQ, metric_name),
                    Condition(Column("timestamp"), Op.GTE, stats_start),
                    Condition(Column("timestamp"), Op.LT, now),
                    Condition(
                        Column(session_status_column_name),
                        Op.EQ,
                        session_init_tag_value,
                    ),
                ],
                granularity=Granularity(stats_rollup),
                groupby=aggregates,
            ),
            referrer="release_health.metrics.get_health_stats_for_overview",
        )["data"]:
            time_bucket = int(
                (parse_snuba_datetime(row["bucketed_time"]) - stats_start).total_seconds()
                / stats_rollup
            )
            key = row["project_id"], reverse_resolve(row[release_column_name])
            timeseries = rv[key]
            if time_bucket < len(timeseries):
                timeseries[time_bucket][1] = row["value"]

        return rv

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[OverviewStat] = None,
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        if stat is None:
            stat = "sessions"
        assert stat in ("sessions", "users")
        if now is None:
            now = datetime.now(pytz.utc)

        _, summary_start, _ = get_rollup_starts_and_buckets(summary_stats_period or "24h", now=now)
        rollup = LEGACY_SESSIONS_DEFAULT_ROLLUP

        org_id = self._get_org_id([x for x, _ in project_releases])

        where: List[Condition] = [
            Condition(Column("org_id"), Op.EQ, org_id),
            filter_projects_by_project_release(project_releases),
            Condition(Column("timestamp"), Op.GTE, summary_start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        if environments is not None:
            where.append(
                Condition(
                    Column(resolve_tag_key("environment")),
                    Op.IN,
                    resolve_many_weak(environments),
                )
            )

        if health_stats_period:
            health_stats_data = self._get_health_stats_for_overview(
                where, org_id, health_stats_period, stat, now
            )
        else:
            health_stats_data = {}

        rv_durations = self._get_session_duration_data_for_overview(where, org_id, rollup)
        rv_errored_sessions = self._get_errored_sessions_for_overview(where, org_id, rollup)
        rv_sessions = self._get_session_by_status_for_overview(where, org_id, rollup)
        rv_users = self._get_users_and_crashed_users_for_overview(where, org_id, rollup)

        # XXX: In order to be able to dual-read and compare results from both
        # old and new backend, this should really go back through the
        # release_health service instead of directly calling `self`. For now
        # that makes the entire backend too hard to test though.
        release_adoption = self.get_release_adoption(project_releases, environments)

        rv: Dict[ProjectRelease, ReleaseHealthOverview] = {}

        fetch_has_health_data_releases = set()

        default_adoption_info: ReleaseAdoption = {
            "adoption": None,
            "sessions_adoption": None,
            "users_24h": None,
            "project_users_24h": None,
            "sessions_24h": None,
            "project_sessions_24h": None,
        }

        for project_id, release in project_releases:
            adoption_info: ReleaseAdoption = (
                release_adoption.get((project_id, release)) or default_adoption_info
            )

            total_sessions = rv_sessions.get((project_id, release, "init"))

            total_users = rv_users.get((project_id, release, "init"))
            has_health_data = bool(total_sessions)

            # has_health_data is supposed to be irrespective of the currently
            # selected rollup window. Therefore we need to run another query
            # over 90d just to see if health data is available to compute
            # has_health_data correctly.
            if not has_health_data and summary_stats_period != "90d":
                fetch_has_health_data_releases.add((project_id, release))

            sessions_crashed = rv_sessions.get((project_id, release, "crashed"), 0)

            users_crashed = rv_users.get((project_id, release, "crashed"), 0)

            rv_row = rv[project_id, release] = {
                "adoption": adoption_info.get("adoption"),
                "sessions_adoption": adoption_info.get("sessions_adoption"),
                "total_users_24h": adoption_info.get("users_24h"),
                "total_project_users_24h": adoption_info.get("project_users_24h"),
                "total_sessions_24h": adoption_info.get("sessions_24h"),
                "total_project_sessions_24h": adoption_info.get("project_sessions_24h"),
                "total_sessions": total_sessions,
                "total_users": total_users,
                "has_health_data": has_health_data,
                "sessions_crashed": sessions_crashed,
                "crash_free_users": (
                    100 - users_crashed / total_users * 100 if total_users else None
                ),
                "crash_free_sessions": (
                    100 - sessions_crashed / float(total_sessions) * 100 if total_sessions else None
                ),
                "sessions_errored": max(
                    0,
                    rv_errored_sessions.get((project_id, release), 0)
                    + rv_sessions.get((project_id, release, "errored_preaggr"), 0)
                    - sessions_crashed
                    - rv_sessions.get((project_id, release, "abnormal"), 0),
                ),
                "duration_p50": None,
                "duration_p90": None,
            }

            durations = rv_durations.get((project_id, release))
            if durations:
                rv_row.update(durations)

            if health_stats_period:
                rv_row["stats"] = {health_stats_period: health_stats_data[project_id, release]}

        if fetch_has_health_data_releases:
            has_health_data = self.check_has_health_data(fetch_has_health_data_releases)  # type: ignore

            for key in fetch_has_health_data_releases:
                rv[key]["has_health_data"] = key in has_health_data  # type: ignore

        return rv

    def _get_crash_free_breakdown_fn(
        self,
        org_id: int,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Callable[[datetime], CrashFreeBreakdown]:
        def generate_defaults(end: datetime) -> CrashFreeBreakdown:
            """Function to use if querying snuba is not necessary"""
            return {
                "crash_free_sessions": None,
                "crash_free_users": None,
                "date": end,
                "total_sessions": 0,
                "total_users": 0,
            }

        # 1) Get required string indexes
        try:
            release_key = resolve_tag_key("release")
            release_value = resolve_weak(release)
            environment_key = resolve_tag_key("environment")
            status_key = resolve_tag_key("session.status")
        except MetricIndexNotFound:
            # No need to query snuba if any of these is missing
            return generate_defaults

        environment_values = None
        if environments is not None:
            environment_values = resolve_many_weak(environments)

        if environment_values == []:
            # No need to query snuba with an empty list
            return generate_defaults

        status_init = indexer.resolve("init")
        status_crashed = indexer.resolve("crashed")

        conditions = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column(release_key), Op.EQ, release_value),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column(status_key), Op.IN, [status_init, status_crashed]),
        ]
        if environment_values is not None:
            conditions.append(Condition(Column(environment_key), Op.IN, environment_values))

        def query_stats(end: datetime) -> CrashFreeBreakdown:
            def _get_data(
                entity_key: EntityKey, metric_key: MetricKey, referrer: str
            ) -> Tuple[int, int]:
                total = 0
                crashed = 0
                metric_id = indexer.resolve(metric_key.value)
                if metric_id is not None:
                    where = conditions + [
                        Condition(Column("metric_id"), Op.EQ, metric_id),
                        Condition(Column("timestamp"), Op.LT, end),
                    ]

                    if entity_key == EntityKey.MetricsCounters:
                        aggregation_function = "sum"
                    elif entity_key == EntityKey.MetricsSets:
                        aggregation_function = "uniq"
                    else:
                        raise NotImplementedError(f"No support for entity: {entity_key}")
                    columns = [Function(aggregation_function, [Column("value")], "value")]

                    data = raw_snql_query(
                        Query(
                            dataset=Dataset.Metrics.value,
                            match=Entity(entity_key.value),
                            select=columns,
                            where=where,
                            groupby=[Column(status_key)],
                            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                        ),
                        referrer=referrer,
                    )["data"]
                    for row in data:
                        if row[status_key] == status_init:
                            total = int(row["value"])
                        elif row[status_key] == status_crashed:
                            crashed = int(row["value"])

                return total, crashed

            sessions_total, sessions_crashed = _get_data(
                EntityKey.MetricsCounters,
                MetricKey.SESSION,
                referrer="release_health.metrics.crash-free-breakdown.session",
            )
            users_total, users_crashed = _get_data(
                EntityKey.MetricsSets,
                MetricKey.USER,
                referrer="release_health.metrics.crash-free-breakdown.users",
            )

            return {
                "date": end,
                "total_users": users_total,
                "crash_free_users": 100 - users_crashed / float(users_total) * 100
                if users_total
                else None,
                "total_sessions": sessions_total,
                "crash_free_sessions": 100 - sessions_crashed / float(sessions_total) * 100
                if sessions_total
                else None,
            }

        return query_stats

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
    ) -> Sequence[CrashFreeBreakdown]:

        org_id = self._get_org_id([project_id])

        if now is None:
            now = datetime.now(pytz.utc)

        query_fn = self._get_crash_free_breakdown_fn(
            org_id, project_id, release, start, environments
        )

        last: Optional[datetime] = None
        rv = []
        for offset in (
            timedelta(days=1),
            timedelta(days=2),
            timedelta(days=7),
            timedelta(days=14),
            timedelta(days=30),
        ):
            try:
                end = start + offset
                if end > now:
                    if last is None or (end - last).days > 1:
                        rv.append(query_fn(now))
                    break
                rv.append(query_fn(end))
                last = end
            except QueryOutsideRetentionError:
                # cannot query for these
                pass

        return rv

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
        now: Optional[datetime] = None,
    ) -> Sequence[ProjectRelease]:

        if now is None:
            now = datetime.now(pytz.utc)

        start = now - timedelta(days=3)

        project_ids = list(project_ids)

        if len(project_ids) == 0:
            return []

        org_id = self._get_org_id(project_ids)
        release_column_name = resolve_tag_key("release")

        query_cols = [Column("project_id"), Column(release_column_name)]

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=query_cols,
            where=where_clause,
            groupby=query_cols,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
        )
        result = raw_snql_query(
            query,
            referrer="release_health.metrics.get_changed_project_release_model_adoptions",
            use_cache=False,
        )

        def extract_row_info(row: Mapping[str, Union[OrganizationId, str]]) -> ProjectRelease:
            return row.get("project_id"), reverse_resolve(row.get(release_column_name))  # type: ignore

        return [extract_row_info(row) for row in result["data"]]

    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
        now: Optional[datetime] = None,
    ) -> Mapping[ProjectRelease, str]:
        if now is None:
            now = datetime.now(pytz.utc)

        # TODO: assumption about retention?
        start = now - timedelta(days=90)

        project_ids: List[ProjectId] = [x[0] for x in project_releases]
        org_id = self._get_org_id(project_ids)
        release_column_name = resolve_tag_key("release")
        releases = [x[1] for x in project_releases]
        releases_ids = resolve_many_weak(releases)

        query_cols = [
            Column("project_id"),
            Column(release_column_name),
            Function("min", [Column("bucketed_time")], "oldest"),
        ]

        group_by = [
            Column("project_id"),
            Column(release_column_name),
        ]

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column(release_column_name), Op.IN, releases_ids),
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=query_cols,
            where=where_clause,
            groupby=group_by,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
        )
        rows = raw_snql_query(
            query,
            referrer="release_health.metrics.get_oldest_health_data_for_releases",
            use_cache=False,
        )["data"]

        result = {}

        for row in rows:
            result[row["project_id"], reverse_resolve(row[release_column_name])] = row["oldest"]

        return result

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
    ) -> int:

        if now is None:
            now = datetime.now(pytz.utc)

        if stats_period is None:
            stats_period = "24h"

        # Special rule that we support sorting by the last 24h only.
        if scope.endswith("_24h"):
            stats_period = "24h"

        granularity, stats_start, _ = get_rollup_starts_and_buckets(stats_period, now=now)
        where = [
            Condition(Column("timestamp"), Op.GTE, stats_start),
            Condition(Column("timestamp"), Op.LT, now),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("org_id"), Op.EQ, organization_id),
        ]

        try:
            release_column_name = resolve_tag_key("release")
        except MetricIndexNotFound:
            return 0

        if environments is not None:
            try:
                environment_column_name = resolve_tag_key("environment")
            except MetricIndexNotFound:
                return 0

            environment_values = resolve_many_weak(environments)
            where.append(Condition(Column(environment_column_name), Op.IN, environment_values))

        having = []

        # Filter out releases with zero users when sorting by either `users` or `crash_free_users`
        if scope in ["users", "crash_free_users"]:
            having.append(Condition(Function("uniq", [Column("value")], "value"), Op.GT, 0))
            match = Entity(EntityKey.MetricsSets.value)
        else:
            match = Entity(EntityKey.MetricsCounters.value)

        query_columns = [
            Function(
                "uniqExact", [Column(release_column_name), Column("project_id")], alias="count"
            )
        ]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=match,
            select=query_columns,
            where=where,
            having=having,
            granularity=Granularity(granularity),
        )

        rows = raw_snql_query(query, referrer="release_health.metrics.get_project_releases_count")[
            "data"
        ]

        ret_val: int = rows[0]["count"] if rows else 0
        return ret_val

    @staticmethod
    def _sort_by_timestamp(series: Mapping[datetime, _V]) -> Sequence[Tuple[int, _V]]:
        """Transform a datetime -> X mapping to a sorted list of (ts, X) tuples
        This is needed to match the output format of get_project_release_stats
        """
        rv = [(int(to_timestamp(dt)), data) for dt, data in series.items()]
        rv.sort(key=itemgetter(0))
        return rv

    def _get_project_release_stats_durations(
        self,
        org_id: OrganizationId,
        where: List[Expression],
        session_status_key: str,
        rollup: int,
    ) -> Mapping[datetime, DurationPercentiles]:
        series: MutableMapping[datetime, DurationPercentiles] = {}
        session_status_healthy = indexer.resolve("exited")
        if session_status_healthy is not None:
            duration_series_data = raw_snql_query(
                Query(
                    dataset=Dataset.Metrics.value,
                    where=where
                    + [
                        Condition(
                            Column("metric_id"),
                            Op.EQ,
                            resolve(MetricKey.SESSION_DURATION.value),
                        ),
                        Condition(Column(session_status_key), Op.EQ, session_status_healthy),
                    ],
                    granularity=Granularity(rollup),
                    match=Entity(EntityKey.MetricsDistributions.value),
                    select=[
                        Function("quantiles(0.5, 0.90)", [Column("value")], alias="quantiles"),
                    ],
                    groupby=[Column("bucketed_time")],
                ),
                referrer="release_health.metrics.get_project_release_stats_durations",
            )["data"]
            for row in duration_series_data:
                dt = parse_snuba_datetime(row["bucketed_time"])
                quantiles: Sequence[float] = row["quantiles"]
                p50, p90 = quantiles
                series[dt] = {"duration_p50": p50, "duration_p90": p90}

        return series

    @staticmethod
    def _default_session_counts() -> SessionCounts:
        return {
            "sessions": 0,
            "sessions_healthy": 0,
            "sessions_crashed": 0,
            "sessions_abnormal": 0,
            "sessions_errored": 0,
        }

    def _get_project_release_stats_sessions(
        self,
        org_id: OrganizationId,
        where: List[Expression],
        session_status_key: str,
        rollup: int,
    ) -> Tuple[Mapping[datetime, SessionCounts], SessionCounts]:
        session_series_data = raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                where=where
                + [Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value))],
                granularity=Granularity(rollup),
                match=Entity(EntityKey.MetricsCounters.value),
                select=[
                    Function("sum", [Column("value")], alias="value"),
                ],
                groupby=[Column("bucketed_time"), Column(session_status_key)],
            )
        )["data"]

        series: DefaultDict[datetime, SessionCounts] = defaultdict(self._default_session_counts)

        for row in session_series_data:
            dt = parse_snuba_datetime(row["bucketed_time"])
            target = series[dt]
            status = reverse_resolve(row[session_status_key])
            value = int(row["value"])
            if status == "init":
                target["sessions"] = value
                # Set same value for 'healthy', this will later be subtracted by errors
                target["sessions_healthy"] = value
            elif status == "abnormal":
                target["sessions_abnormal"] = value
                # This is an error state, so subtract from total error count
                target["sessions_errored"] -= value
            elif status == "crashed":
                target["sessions_crashed"] = value
                # This is an error state, so subtract from total error count
                target["sessions_errored"] -= value
            elif status == "errored_preaggr":
                target["sessions_errored"] += value
                target["sessions_healthy"] -= value
            else:
                logger.warning("Unexpected session.status '%s'", status)

        session_error_series_data = raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                where=where
                + [Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION_ERROR.value))],
                granularity=Granularity(rollup),
                match=Entity(EntityKey.MetricsSets.value),
                select=[
                    Function("uniq", [Column("value")], alias="value"),
                ],
                groupby=[Column("bucketed_time")],
            )
        )["data"]

        for row in session_error_series_data:
            dt = parse_snuba_datetime(row["bucketed_time"])
            target = series[dt]
            value = int(row["value"])
            # Add to errored:
            target["sessions_errored"] = max(0, target["sessions_errored"] + value)
            # Subtract from healthy:
            target["sessions_healthy"] = max(0, target["sessions_healthy"] - value)

        totals: SessionCounts = {
            # Thank mypy for the code duplication
            "sessions": sum(data["sessions"] for data in series.values()),
            "sessions_healthy": sum(data["sessions_healthy"] for data in series.values()),
            "sessions_crashed": sum(data["sessions_crashed"] for data in series.values()),
            "sessions_abnormal": sum(data["sessions_abnormal"] for data in series.values()),
            "sessions_errored": sum(data["sessions_errored"] for data in series.values()),
        }

        return series, totals

    @staticmethod
    def _default_user_counts() -> UserCounts:
        return {
            "users": 0,
            "users_abnormal": 0,
            "users_crashed": 0,
            "users_errored": 0,
            "users_healthy": 0,
        }

    def _get_project_release_stats_users(
        self,
        org_id: OrganizationId,
        where: List[Expression],
        session_status_key: str,
        rollup: int,
    ) -> Tuple[Mapping[datetime, UserCounts], UserCounts]:

        user_series_data = raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                where=where
                + [Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value))],
                granularity=Granularity(rollup),
                match=Entity(EntityKey.MetricsSets.value),
                select=[
                    Function("uniq", [Column("value")], alias="value"),
                ],
                groupby=[Column("bucketed_time"), Column(session_status_key)],
            )
        )["data"]

        user_totals_data = raw_snql_query(
            Query(
                dataset=Dataset.Metrics.value,
                where=where
                + [Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value))],
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                match=Entity(EntityKey.MetricsSets.value),
                select=[
                    Function("uniq", [Column("value")], alias="value"),
                ],
                groupby=[Column(session_status_key)],
            )
        )["data"]

        series: DefaultDict[datetime, UserCounts] = defaultdict(self._default_user_counts)
        totals: UserCounts = self._default_user_counts()

        for is_totals, data in [(False, user_series_data), (True, user_totals_data)]:
            for row in data:
                if is_totals:
                    target = totals
                else:
                    dt = parse_snuba_datetime(row["bucketed_time"])
                    target = series[dt]
                status = reverse_resolve(row[session_status_key])
                value = int(row["value"])
                if status == "init":
                    target["users"] = value
                    # Set same value for 'healthy', this will later be subtracted by errors
                    target["users_healthy"] += value
                else:
                    if status == "abnormal":
                        # Subtract this special error state from sum of all errors
                        target["users_abnormal"] += value
                        target["users_errored"] -= value
                    elif status == "crashed":
                        # Subtract this special error state from sum of all errors
                        target["users_crashed"] += value
                        target["users_errored"] -= value
                    elif status == "errored":
                        # Subtract sum of all errors from healthy sessions
                        target["users_errored"] += value
                        target["users_healthy"] -= value

        # Replace negative values
        for data in itertools.chain(series.values(), [totals]):
            data["users_healthy"] = max(0, data["users_healthy"])
            data["users_errored"] = max(0, data["users_errored"])

        return series, totals

    @staticmethod
    def _merge_dict_values(
        *dicts: Mapping[_K1, Mapping[_K2, _V]]
    ) -> Mapping[_K1, Mapping[_K2, _V]]:
        rv: MutableMapping[_K1, MutableMapping[_K2, _V]] = {}
        for dct in dicts:
            for key, value in dct.items():
                rv.setdefault(key, {}).update(value)

        return rv

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
        assert stat in ("users", "sessions")

        org_id = self._get_org_id([project_id])

        start = to_datetime((to_timestamp(start) // rollup + 1) * rollup)

        # since snuba end queries are exclusive of the time and we're bucketing to
        # 10 seconds, we need to round to the next 10 seconds since snuba is
        # exclusive on the end.
        end = to_datetime(
            (to_timestamp(end) // SMALLEST_METRICS_BUCKET + 1) * SMALLEST_METRICS_BUCKET
        )

        times: List[datetime] = []
        time = start
        delta = timedelta(seconds=rollup)
        while time < end:
            times.append(time)
            time += delta

        # Generate skeleton for the returned data:
        base_series = {
            time: {
                "duration_p50": None,
                "duration_p90": None,
                f"{stat}": 0,
                f"{stat}_abnormal": 0,
                f"{stat}_crashed": 0,
                f"{stat}_errored": 0,
                f"{stat}_healthy": 0,
            }
            for time in times
        }
        base_totals = {
            f"{stat}": 0,
            f"{stat}_abnormal": 0,
            f"{stat}_crashed": 0,
            f"{stat}_errored": 0,
            f"{stat}_healthy": 0,
        }

        try:
            release_value = resolve_weak(release)
        except MetricIndexNotFound:
            # No data for this release
            return self._sort_by_timestamp(base_series), base_totals  # type: ignore

        where = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column(resolve_tag_key("release")), Op.EQ, release_value),
        ]

        if environments is not None:
            where.append(
                Condition(
                    Column(resolve_tag_key("environment")),
                    Op.IN,
                    resolve_many_weak(environments),
                )
            )

        session_status_key = resolve_tag_key("session.status")

        duration_series = self._get_project_release_stats_durations(
            org_id, where, session_status_key, rollup
        )

        series: Mapping[datetime, Union[UserCounts, SessionCounts]]
        totals: Union[UserCounts, SessionCounts]

        if stat == "users":
            series, totals = self._get_project_release_stats_users(
                org_id, where, session_status_key, rollup
            )
        else:
            series, totals = self._get_project_release_stats_sessions(
                org_id, where, session_status_key, rollup
            )

        # Merge data:
        merged_series = self._merge_dict_values(base_series, duration_series, series)
        merged_totals = dict(base_totals, **totals)

        # Convert series to desired output format:
        sorted_series = self._sort_by_timestamp(merged_series)

        return sorted_series, merged_totals  # type: ignore

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:

        org_id = self._get_org_id([project_id])
        columns = [Function("sum", [Column("value")], "value")]

        try:
            status_key = resolve_tag_key("session.status")
            status_init = resolve_weak("init")
        except MetricIndexNotFound:
            return 0

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column(status_key), Op.EQ, status_init),
        ]

        if environment_id is not None:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names = _model_environment_ids_to_environment_names([environment_id])
            env_name = env_names[environment_id]
            if env_name is None:
                return 0  # could not find the requested environment

            try:
                snuba_env_id = resolve_weak(env_name)
                env_id = resolve_tag_key("environment")
            except MetricIndexNotFound:
                return 0

            where_clause.append(Condition(Column(env_id), Op.EQ, snuba_env_id))

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=columns,
            where=where_clause,
            granularity=Granularity(rollup),
        )

        rows = raw_snql_query(query, referrer="release_health.metrics.get_project_sessions_count")[
            "data"
        ]

        ret_val: int = int(rows[0]["value"]) if rows else 0
        return ret_val

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:

        org_id = self._get_org_id(project_ids)
        columns = [Function("sum", [Column("value")], alias="value"), Column("project_id")]

        try:
            status_key = resolve_tag_key("session.status")
            status_init = resolve_weak("init")
        except MetricIndexNotFound:
            return []

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value)),
            Condition(Column("timestamp"), Op.GTE, start),
            Condition(Column("timestamp"), Op.LT, end),
            Condition(Column(status_key), Op.EQ, status_init),
            Condition(Column("project_id"), Op.IN, project_ids),
        ]

        if environment_ids:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names_dict = _model_environment_ids_to_environment_names(environment_ids)
            env_names = [value for value in env_names_dict.values() if value is not None]

            try:
                env_id = resolve_tag_key("environment")
                snuba_env_ids = resolve_many_weak(env_names)
            except MetricIndexNotFound:
                return []

            where_clause.append(Condition(Column(env_id), Op.IN, snuba_env_ids))

        group_by = [Column("project_id")]

        query = Query(
            dataset=Dataset.Metrics.value,
            match=Entity(EntityKey.MetricsCounters.value),
            select=columns,
            where=where_clause,
            groupby=group_by,
            granularity=Granularity(
                rollup if rollup is not None else LEGACY_SESSIONS_DEFAULT_ROLLUP
            ),
        )

        rows = raw_snql_query(
            query, referrer="release_health.metrics.get_num_sessions_per_project"
        )["data"]

        return [(row["project_id"], int(row["value"])) for row in rows]

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

        if len(project_ids) == 0:
            return []

        org_id = self._get_org_id(project_ids)
        environments_ids: Optional[Sequence[int]] = None

        if environments is not None:
            environments_ids = resolve_many_weak(environments)
            if not environments_ids:
                return []

        release_column_name = resolve_tag_key("release")

        if stats_period is None:
            stats_period = "24h"

        # Special rule that we support sorting by the last 24h only.
        if scope.endswith("_24h"):
            scope = scope[:-4]
            stats_period = "24h"

        if now is None:
            now = datetime.now(pytz.utc)

        granularity, stats_start, _ = get_rollup_starts_and_buckets(stats_period, now=now)

        query_cols = [
            Column("project_id"),
            Column(release_column_name),
        ]

        where_clause = [
            Condition(Column("org_id"), Op.EQ, org_id),
            Condition(Column("project_id"), Op.IN, project_ids),
            Condition(Column("timestamp"), Op.GTE, stats_start),
            Condition(Column("timestamp"), Op.LT, now),
        ]

        if environments_ids is not None:
            environment_column_name = resolve_tag_key("environment")
            where_clause.append(Condition(Column(environment_column_name), Op.IN, environments_ids))

        having_clause: Optional[List[Condition]] = None

        status_init = resolve_weak("init")
        status_crashed = resolve_weak("crashed")
        session_status_column_name = resolve_tag_key("session.status")

        order_by_clause = None
        if scope == "crash_free_sessions":
            order_by_clause = [
                OrderBy(
                    exp=Function(
                        "divide",
                        parameters=[
                            Function(
                                "sumIf",
                                parameters=[
                                    Column("value"),
                                    Function(
                                        "equals",
                                        [Column(session_status_column_name), status_crashed],
                                    ),
                                ],
                            ),
                            Function(
                                "sumIf",
                                parameters=[
                                    Column("value"),
                                    Function(
                                        "equals", [Column(session_status_column_name), status_init]
                                    ),
                                ],
                            ),
                        ],
                    ),
                    direction=Direction.DESC,
                )
            ]
            where_clause.append(
                Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value))
            )
            entity = Entity(EntityKey.MetricsCounters.value)
        elif scope == "sessions":
            order_by_clause = [
                OrderBy(exp=Function("sum", [Column("value")], "value"), direction=Direction.DESC)
            ]
            where_clause.append(
                Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.SESSION.value))
            )
            entity = Entity(EntityKey.MetricsCounters.value)
        elif scope == "crash_free_users":
            order_by_clause = [
                OrderBy(
                    exp=Function(
                        "divide",
                        parameters=[
                            Function(
                                "uniqIf",
                                parameters=[
                                    Column("value"),
                                    Function(
                                        "equals",
                                        [Column(session_status_column_name), status_crashed],
                                    ),
                                ],
                            ),
                            Function(
                                "uniqIf",
                                parameters=[
                                    Column("value"),
                                    Function(
                                        "equals", [Column(session_status_column_name), status_init]
                                    ),
                                ],
                            ),
                        ],
                    ),
                    direction=Direction.DESC,
                )
            ]
            where_clause.append(
                Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value))
            )
            entity = Entity(EntityKey.MetricsSets.value)
            having_clause = [Condition(Function("uniq", [Column("value")], "users"), Op.GT, 0)]
        else:  # users
            users_column = Function("uniq", [Column("value")], "users")
            order_by_clause = [OrderBy(exp=users_column, direction=Direction.DESC)]
            where_clause.append(
                Condition(Column("metric_id"), Op.EQ, resolve(MetricKey.USER.value))
            )
            entity = Entity(EntityKey.MetricsSets.value)
            having_clause = [Condition(users_column, Op.GT, 0)]

        # Partial tiebreaker to make comparisons in the release-health duplex
        # backend more likely to succeed. A perfectly stable sorting would need to
        # additionally sort by `release`, however in the metrics backend we can't
        # sort by that the same way as in the sessions backend.
        order_by_clause.append(OrderBy(Column("project_id"), Direction.DESC))

        query = Query(
            dataset=Dataset.Metrics.value,
            match=entity,
            select=query_cols,
            where=where_clause,
            having=having_clause,
            orderby=order_by_clause,
            groupby=query_cols,
            offset=Offset(offset) if offset is not None else None,
            limit=Limit(limit) if limit is not None else None,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
        )

        rows = raw_snql_query(
            query,
            referrer="release_health.metrics.get_project_releases_by_stability",
            use_cache=False,
        )

        def extract_row_info(row: Mapping[str, Union[OrganizationId, str]]) -> ProjectRelease:
            return row.get("project_id"), reverse_resolve(row.get(release_column_name))  # type: ignore

        return [extract_row_info(row) for row in rows["data"]]
