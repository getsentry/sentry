import logging
from collections import defaultdict
from collections.abc import Callable, Collection, Iterable, Mapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, TypeVar

from snuba_sdk import Column, Condition, Direction, Op
from snuba_sdk.expressions import Granularity, Limit, Offset

from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.release_health.base import (
    AllowedResolution,
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
    ReleaseAdoption,
    ReleaseHealthBackend,
    ReleaseHealthOverview,
    ReleaseName,
    ReleasesAdoption,
    ReleaseSessionsTimeBounds,
    SessionsQueryConfig,
    SessionsQueryResult,
    StatsPeriod,
)
from sentry.release_health.metrics_sessions_v2 import run_sessions_query
from sentry.sentry_metrics import indexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics import (
    DeprecatingMetricsQuery,
    MetricField,
    MetricGroupByField,
    MetricOrderByField,
    get_series,
)
from sentry.snuba.metrics.naming_layer.mri import SessionMRI
from sentry.snuba.sessions import _make_stats, get_rollup_starts_and_buckets
from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.dates import to_datetime
from sentry.utils.safe import get_path
from sentry.utils.snuba import QueryOutsideRetentionError

SMALLEST_METRICS_BUCKET = 10
SENTRY_FIRST_COMMIT_DATE = datetime(2008, 5, 8, tzinfo=timezone.utc)

# Whenever a snuba query agains the old sessions table is done without both 1)
# an explicit rollup 2) a groupby some timestamp/bucket, Snuba will pick a
# default rollup of 3600 and pick sessions_hourly_dist over sessions_raw_dist,
# regardless of the timerange chosen.
#
# In order to make functional comparison easier, the metrics implementation
# (explicitly) chooses the same rollup in the equivalent queries, and uses this
# constant to denote that case.
MINUTE = 60  # 60 seconds
HOUR = MINUTE * 60
DAY = HOUR * 24
LEGACY_SESSIONS_DEFAULT_ROLLUP = HOUR
USE_CASE_ID = UseCaseID.SESSIONS

logger = logging.getLogger(__name__)

_V = TypeVar("_V")


def filter_projects_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(Column("project_id"), Op.IN, [proj for proj, _rel in project_releases])


def filter_releases_by_project_release(project_releases: Sequence[ProjectRelease]) -> Condition:
    return Condition(
        lhs=Column(name="tags[release]"),
        op=Op.IN,
        rhs=[rel for _proj, rel in project_releases],
    )


def _model_environment_ids_to_environment_names(
    environment_ids: Sequence[int],
) -> Mapping[int, str | None]:
    """
    Maps Environment Model ids to the environment name
    Note: this does a Db lookup
    """
    empty_string_to_none: Callable[[Any], Any | None] = lambda v: None if v == "" else v
    id_to_name: Mapping[int, str | None] = {
        k: empty_string_to_none(v)
        for k, v in Environment.objects.filter(id__in=environment_ids).values_list("id", "name")
    }
    return defaultdict(lambda: None, id_to_name)


class MetricsReleaseHealthBackend(ReleaseHealthBackend):
    """
    Implementation of the ReleaseHealthBackend using the MetricsLayer API
    """

    @staticmethod
    def _get_org_id(project_ids: Sequence[int]) -> int:
        return MetricsReleaseHealthBackend._get_projects_and_org_id(project_ids)[1]

    @staticmethod
    def _get_projects(project_ids: Sequence[int]) -> Sequence[Project]:
        return MetricsReleaseHealthBackend._get_projects_and_org_id(project_ids)[0]

    @staticmethod
    def _get_projects_and_org_id(project_ids: Sequence[int]) -> tuple[Sequence[Project], int]:
        projects = Project.objects.get_many_from_cache(project_ids)
        org_ids: set[int] = {project.organization_id for project in projects}
        if len(org_ids) != 1:
            raise ValueError("Expected projects to be from the same organization")

        return projects, org_ids.pop()

    @staticmethod
    def _extract_crash_free_rates_from_result_groups(
        result_groups: Sequence[Any],
    ) -> dict[int, float | None]:
        crash_free_rates: dict[int, float | None] = {}
        for result_group in result_groups:
            project_id = get_path(result_group, "by", "project_id")
            if project_id is None:
                continue

            totals = get_path(result_group, "totals", "rate", should_log=True)
            if totals is not None:
                crash_free_rates[project_id] = totals * 100
            else:
                crash_free_rates[project_id] = None

        return crash_free_rates

    @staticmethod
    def _get_crash_free_rate_data(
        org_id: int,
        projects: Sequence[Project],
        start: datetime,
        end: datetime,
        rollup: int,
    ) -> dict[int, float | None]:

        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.CRASH_FREE_RATE.value, alias="rate", op=None),
        ]

        groupby = [
            MetricGroupByField(field="project_id"),
        ]
        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(rollup),
            groupby=groupby,
            include_series=False,
            include_totals=True,
        )
        result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)
        result_groups = get_path(result, "groups", default=[])
        return MetricsReleaseHealthBackend._extract_crash_free_rates_from_result_groups(
            result_groups=result_groups
        )

    def get_current_and_previous_crash_free_rates(
        self,
        project_ids: Sequence[int],
        current_start: datetime,
        current_end: datetime,
        previous_start: datetime,
        previous_end: datetime,
        rollup: int,
        org_id: int | None = None,
    ) -> CurrentAndPreviousCrashFreeRates:

        projects, proj_org_id = self._get_projects_and_org_id(project_ids)

        if org_id is None:
            org_id = proj_org_id
        else:
            if org_id != proj_org_id:
                # the specified org_id is not the projects' organization
                raise ValueError("Expected projects to be from the specified organization")

        projects_crash_free_rate_dict: CurrentAndPreviousCrashFreeRates = {
            prj: {"currentCrashFreeRate": None, "previousCrashFreeRate": None}
            for prj in project_ids
        }
        previous = self._get_crash_free_rate_data(
            org_id,
            projects,
            previous_start,
            previous_end,
            rollup,
        )

        current = self._get_crash_free_rate_data(
            org_id,
            projects,
            current_start,
            current_end,
            rollup,
        )

        for project_id, project_data in projects_crash_free_rate_dict.items():
            project_data["previousCrashFreeRate"] = previous.get(project_id)
            project_data["currentCrashFreeRate"] = current.get(project_id)

        return projects_crash_free_rate_dict

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Sequence[EnvironmentName] | None = None,
        now: datetime | None = None,
        org_id: OrganizationId | None = None,
    ) -> ReleasesAdoption:
        project_ids = list({x[0] for x in project_releases})
        if org_id is None:
            org_id = self._get_org_id(project_ids)

        if now is None:
            now = datetime.now(timezone.utc)

        return self._get_release_adoption_impl(now, org_id, project_releases, environments)

    @staticmethod
    def _get_release_adoption_impl(
        now: datetime,
        org_id: int,
        project_releases: Sequence[ProjectRelease],
        environments: Sequence[EnvironmentName] | None = None,
    ) -> ReleasesAdoption:
        start = now - timedelta(days=1)
        project_ids = [proj for proj, _rel in project_releases]
        projects = MetricsReleaseHealthBackend._get_projects(project_ids)

        def _get_common_where(total: bool) -> list[Condition]:
            where_common: list[Condition] = [
                filter_projects_by_project_release(project_releases),
            ]

            if environments is not None:
                where_common.append(
                    Condition(
                        lhs=Column("tags[environment]"),
                        op=Op.IN,
                        rhs=environments,
                    )
                )

            if not total:
                where_common.append(filter_releases_by_project_release(project_releases))

            return where_common

        def _get_common_groupby(total: bool) -> list[MetricGroupByField]:
            if total:
                return [MetricGroupByField(field="project_id")]
            else:
                return [
                    MetricGroupByField(field="project_id"),
                    MetricGroupByField(field="release"),
                ]

        def _convert_results(groups: Any, total: bool) -> dict[Any, int]:
            """
            Converts the result groups into an array of values:

            from [{ "by": {"project_id": 123, "release": "r1"}, "totals": {"init": 23.3}},...]
            to:
             { 123: 23.3, ...} // for totals
             { (123, "r1"): 23.3, ...} // for details

            """
            ret_val = {}
            for group in groups:
                if total:
                    idx = get_path(group, "by", "project_id")
                else:
                    by = group.get("by", {})
                    idx = by.get("project_id"), by.get("release")
                ret_val[idx] = get_path(group, "totals", "value")
            return ret_val

        def _count_sessions(
            total: bool, project_ids: Sequence[int], referrer: str
        ) -> dict[Any, int]:
            select = [
                MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None),
            ]

            query = DeprecatingMetricsQuery(
                org_id=org_id,
                start=start,
                end=now,
                project_ids=project_ids,
                select=select,
                groupby=_get_common_groupby(total),
                where=_get_common_where(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                include_series=False,
                include_totals=True,
            )
            raw_result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)

            return _convert_results(raw_result["groups"], total=total)

        def _count_users(total: bool, referrer: str) -> dict[Any, int]:
            select = [
                MetricField(metric_mri=SessionMRI.RAW_USER.value, alias="value", op="count_unique")
            ]
            query = DeprecatingMetricsQuery(
                org_id=org_id,
                start=start,
                end=now,
                project_ids=project_ids,
                select=select,
                groupby=_get_common_groupby(total),
                where=_get_common_where(total),
                granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                include_series=False,
                include_totals=True,
            )
            raw_result = get_series(projects=projects, metrics_query=query, use_case_id=USE_CASE_ID)
            return _convert_results(raw_result["groups"], total)

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
        sessions_per_project: dict[int, int] = _count_sessions(
            total=True,
            project_ids=project_ids,
            referrer="release_health.metrics.get_release_adoption.total_sessions",
        )
        users_per_project: dict[int, int] = _count_users(
            total=True, referrer="release_health.metrics.get_release_adoption.total_users"
        )

        # Count of sessions/users for given list of environments and timerange AND GIVEN RELEASES, per-project
        sessions_per_release: dict[tuple[int, str], int] = _count_sessions(
            total=False,
            project_ids=project_ids,
            referrer="release_health.metrics.get_release_adoption.releases_sessions",
        )
        users_per_release: dict[tuple[int, str], int] = _count_users(
            total=False, referrer="release_health.metrics.get_release_adoption.releases_users"
        )

        rv = {}

        for project_id, release in project_releases:
            release_tag_value = indexer.resolve(USE_CASE_ID, org_id, release)
            if release_tag_value is None:
                # Don't emit empty releases -- for exact compatibility with
                # sessions table backend.
                continue

            release_sessions = sessions_per_release.get((project_id, release), 0.0)
            release_users = users_per_release.get((project_id, release), 0.0)

            total_sessions = sessions_per_project.get(project_id, 0.0)
            total_users = users_per_project.get(project_id, 0.0)

            adoption: ReleaseAdoption = {
                "adoption": (
                    release_users / total_users * 100 if release_users and total_users else None
                ),
                "sessions_adoption": (
                    release_sessions / total_sessions * 100
                    if release_sessions and total_sessions
                    else None
                ),
                "users_24h": int(release_users),
                "sessions_24h": int(release_sessions),
                "project_users_24h": int(total_users),
                "project_sessions_24h": int(total_sessions),
            }

            rv[project_id, release] = adoption

        return rv

    def sessions_query_config(self, organization: Any) -> SessionsQueryConfig:
        return SessionsQueryConfig(
            allowed_resolution=AllowedResolution.ten_seconds,
            allow_session_status_query=True,
            restrict_date_range=False,
        )

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
        environments: Iterable[str] | None = None,
    ) -> ReleaseSessionsTimeBounds:

        projects, org_id = self._get_projects_and_org_id([project_id])

        select = [
            MetricField(
                metric_mri=SessionMRI.RAW_SESSION.value,
                alias="min_counter_date",
                op="min_timestamp",
            ),
            MetricField(
                metric_mri=SessionMRI.RAW_SESSION.value,
                alias="max_counter_date",
                op="max_timestamp",
            ),
            MetricField(
                metric_mri=SessionMRI.RAW_DURATION.value, alias="min_dist_date", op="min_timestamp"
            ),
            MetricField(
                metric_mri=SessionMRI.RAW_DURATION.value, alias="max_dist_date", op="max_timestamp"
            ),
        ]

        where = []

        if release:
            where.append(
                Condition(
                    lhs=Column(name="tags[release]"),
                    op=Op.EQ,
                    rhs=release,
                )
            )

        if environments:
            where.append(
                Condition(
                    lhs=Column(name="tags[environment]"),
                    op=Op.IN,
                    rhs=list(environments),
                )
            )

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=[project_id],
            select=select,
            start=SENTRY_FIRST_COMMIT_DATE,
            end=datetime.now(timezone.utc) + timedelta(seconds=10),
            where=where,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]

        def iso_format_snuba_datetime(date: str) -> str:
            return datetime.strptime(date, "%Y-%m-%dT%H:%M:%S+00:00").isoformat()[:19] + "Z"

        formatted_unix_start_time = datetime.fromtimestamp(0).strftime("%Y-%m-%dT%H:%M:%S+00:00")

        def clean_date_string(d: str | None) -> str | None:
            # This check is added because if there are no sessions found, then the
            # aggregation queries return both the sessions_lower_bound and the
            # sessions_upper_bound as `0` timestamp, and we do not want that behaviour
            # by default
            # P.S. To avoid confusion the `0` timestamp which is '1970-01-01 00:00:00'
            # is rendered as '0000-00-00 00:00:00' in clickhouse shell

            # sets and Unix start time dates to None
            if d == formatted_unix_start_time:
                return None
            return d

        min_date = None
        max_date = None
        if groups:
            totals = groups[0]["totals"]
            min_date = clean_date_string(totals.get("min_counter_date"))
            max_date = clean_date_string(totals.get("max_counter_date"))
            min_date2 = clean_date_string(totals.get("min_dist_date"))
            max_date2 = clean_date_string(totals.get("max_dist_date"))

            if min_date is None or (min_date2 is not None and min_date > min_date2):
                min_date = min_date2
            if max_date is None or (max_date2 is not None and max_date < max_date2):
                max_date = max_date2

        if min_date is not None and max_date is not None:
            return {
                "sessions_lower_bound": iso_format_snuba_datetime(min_date),
                "sessions_upper_bound": iso_format_snuba_datetime(max_date),
            }
        else:
            return {
                "sessions_lower_bound": None,
                "sessions_upper_bound": None,
            }

    def check_has_health_data(
        self,
        projects_list: Collection[ProjectOrRelease],
        now: datetime | None = None,
    ) -> set[ProjectOrRelease]:
        if now is None:
            now = datetime.now(timezone.utc)

        start = now - timedelta(days=90)

        projects_list = list(projects_list)

        if len(projects_list) == 0:
            return set()

        includes_releases = isinstance(projects_list[0], tuple)

        if includes_releases:
            project_ids: list[ProjectId] = [x[0] for x in projects_list]  # type: ignore[index]
        else:
            project_ids = projects_list  # type: ignore[assignment]

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.RAW_SESSION.value, alias="value", op="sum")]

        where_clause = []
        groupby = [
            MetricGroupByField(field="project_id"),
        ]

        if includes_releases:
            where_clause.append(filter_releases_by_project_release(projects_list))  # type: ignore[arg-type]
            groupby.append(MetricGroupByField(field="release"))

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=now,
            granularity=Granularity(DAY),
            groupby=groupby,
            where=where_clause,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]

        ret_val = set()
        for group in groups:
            if includes_releases:
                by = group.get("by", {})
                idx = by.get("project_id"), by.get("release")
                ret_val.add(idx)
            else:
                proj_id = get_path(group, "by", "project_id")
                ret_val.add(proj_id)
        return ret_val  # type: ignore[return-value]

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> set[ReleaseName]:
        """
        Returns a set of all release versions that have health data within a given period of time.
        """

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.RAW_SESSION.value, alias="value", op="sum")]
        groupby = [MetricGroupByField(field="release")]
        where_clause = [
            Condition(
                lhs=Column(name="tags[release]"),
                op=Op.IN,
                rhs=release_versions,
            )
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            groupby=groupby,
            where=where_clause,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]

        ret_val = set()
        for group in groups:
            by = group.get("by", {})
            release = by.get("release")
            if release is not None:
                ret_val.add(release)
        return ret_val

    @staticmethod
    def _get_session_duration_data_for_overview(
        projects: Sequence[Project],
        where: list[Condition],
        org_id: int,
        granularity: int,
        start: datetime,
        end: datetime,
    ) -> Mapping[tuple[int, str], Any]:
        """
        Percentiles of session duration
        """
        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.DURATION.value, alias="p50", op="p50"),
            MetricField(metric_mri=SessionMRI.DURATION.value, alias="p90", op="p90"),
        ]

        session_status_cond = Condition(lhs=Column("tags[session.status]"), op=Op.EQ, rhs="exited")
        where = [*where, session_status_cond]

        groupby = [
            MetricGroupByField(field="project_id"),
            MetricGroupByField(field="release"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(granularity),
            groupby=groupby,
            where=where,
            include_series=False,
            include_totals=True,
        )
        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]

        ret_val = {}
        for group in groups:
            by = group.get("by", {})
            proj_id = by.get("project_id")
            release = by.get("release")

            totals = group.get("totals", {})
            p50 = totals.get("p50")
            p90 = totals.get("p90")

            ret_val[(proj_id, release)] = {"duration_p50": p50, "duration_p90": p90}

        return ret_val

    @staticmethod
    def _get_errored_sessions_for_overview(
        projects: Sequence[Project],
        where: list[Condition],
        org_id: int,
        granularity: int,
        start: datetime,
        end: datetime,
    ) -> Mapping[tuple[int, str], int]:
        """
        Count of errored sessions, incl fatal (abnormal, crashed) sessions,
        excl errored *preaggregated* sessions
        """
        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.ERRORED_SET.value, alias="value", op=None),
        ]

        groupby = [
            MetricGroupByField(field="project_id"),
            MetricGroupByField(field="release"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(granularity),
            groupby=groupby,
            where=where,
            include_series=False,
            include_totals=True,
        )
        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]

        ret_val = {}

        for group in groups:
            by = group.get("by", {})
            proj_id = by.get("project_id")
            release = by.get("release")

            value = get_path(group, "totals", "value")
            ret_val[(proj_id, release)] = value
        return ret_val

    @staticmethod
    def _get_session_by_status_for_overview(
        projects: Sequence[Project],
        where: list[Condition],
        org_id: int,
        granularity: int,
        start: datetime,
        end: datetime,
    ) -> Mapping[tuple[int, str, str], int]:
        """
        Counts of init, abnormal and crashed sessions, purpose-built for overview
        """
        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.ABNORMAL.value, alias="abnormal", op=None),
            MetricField(metric_mri=SessionMRI.CRASHED.value, alias="crashed", op=None),
            MetricField(metric_mri=SessionMRI.ALL.value, alias="init", op=None),
            MetricField(
                metric_mri=SessionMRI.ERRORED_PREAGGREGATED.value,
                alias="errored_preaggr",
                op=None,
            ),
        ]

        groupby = [
            MetricGroupByField(field="project_id"),
            MetricGroupByField(field="release"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(granularity),
            groupby=groupby,
            where=where,
            include_series=False,
            include_totals=True,
        )
        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]

        ret_val = {}
        for group in groups:
            by = group.get("by", {})
            proj_id = by.get("project_id")
            release = by.get("release")

            totals = group.get("totals", {})
            for status in ["abnormal", "crashed", "init", "errored_preaggr"]:
                value = totals.get(status)
                if value is not None and value != 0.0:
                    ret_val[(proj_id, release, status)] = value

        return ret_val

    @staticmethod
    def _get_users_and_crashed_users_for_overview(
        projects: Sequence[Project],
        where: list[Condition],
        org_id: int,
        granularity: int,
        start: datetime,
        end: datetime,
    ) -> Mapping[tuple[int, str, str], int]:

        project_ids = [p.id for p in projects]

        select = [
            MetricField(metric_mri=SessionMRI.ALL_USER.value, alias="all_users", op=None),
            MetricField(metric_mri=SessionMRI.CRASHED_USER.value, alias="crashed_users", op=None),
        ]

        groupby = [
            MetricGroupByField(field="release"),
            MetricGroupByField(field="project_id"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            granularity=Granularity(granularity),
            groupby=groupby,
            where=where,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]
        ret_val = {}
        for group in groups:
            by = group.get("by", {})
            proj_id = by.get("project_id")
            release = by.get("release")

            totals = group.get("totals", {})
            for status in ["all_users", "crashed_users"]:
                value = totals.get(status)
                if value is not None:
                    ret_val[(proj_id, release, status)] = value
        return ret_val

    @staticmethod
    def _get_health_stats_for_overview(
        projects: Sequence[Project],
        where: list[Condition],
        org_id: int,
        stat: OverviewStat,
        granularity: int,
        start: datetime,
        end: datetime,
        buckets: int,
    ) -> Mapping[ProjectRelease, list[list[int]]]:

        project_ids = [p.id for p in projects]

        metric_field = {
            "users": MetricField(metric_mri=SessionMRI.ALL_USER.value, alias="value", op=None),
            "sessions": MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None),
        }[stat]

        groupby = [
            MetricGroupByField(field="release"),
            MetricGroupByField(field="project_id"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=[metric_field],
            start=start,
            end=end,
            granularity=Granularity(granularity),
            groupby=groupby,
            where=where,
            include_series=True,
            include_totals=False,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        groups = raw_result["groups"]
        ret_val: dict[ProjectRelease, list[list[int]]] = defaultdict(
            lambda: _make_stats(start, granularity, buckets)
        )

        timestamps = [int(dt.timestamp()) for dt in raw_result["intervals"]]

        for group in groups:
            proj_id = get_path(group, "by", "project_id")
            release = get_path(group, "by", "release")
            series = get_path(group, "series", "value")
            assert len(timestamps)
            data = zip(timestamps, series)
            as_array = [[ts, dt] for ts, dt in data]
            ret_val[(proj_id, release)] = as_array

        return ret_val

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Sequence[EnvironmentName] | None = None,
        summary_stats_period: StatsPeriod | None = None,
        health_stats_period: StatsPeriod | None = None,
        stat: Literal["users", "sessions"] | None = None,
        now: datetime | None = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        """Checks quickly for which of the given project releases we have
        health data available.  The argument is a tuple of `(project_id, release_name)`
        tuples.  The return value is a set of all the project releases that have health
        data.
        """
        if stat is None:
            stat = "sessions"
        assert stat in ("sessions", "users")

        if now is None:
            now = datetime.now(timezone.utc)

        project_ids = [proj_id for proj_id, _release in project_releases]
        projects, org_id = self._get_projects_and_org_id(project_ids)

        granularity, summary_start, stats_buckets = get_rollup_starts_and_buckets(
            summary_stats_period or "24h", now=now
        )
        # NOTE: for backward compatibility with previous implementation some queries use the granularity calculated from
        # stats_period and others use the legacy_session_rollup
        rollup = LEGACY_SESSIONS_DEFAULT_ROLLUP

        where = [filter_projects_by_project_release(project_releases)]

        if health_stats_period:
            health_stats_data = self._get_health_stats_for_overview(
                projects=projects,
                where=where,
                org_id=org_id,
                stat=stat,
                granularity=granularity,
                start=summary_start,
                end=now,
                buckets=stats_buckets,
            )
        else:
            health_stats_data = {}

        rv_durations = self._get_session_duration_data_for_overview(
            projects, where, org_id, rollup, summary_start, now
        )
        rv_errored_sessions = self._get_errored_sessions_for_overview(
            projects, where, org_id, rollup, summary_start, now
        )
        rv_sessions = self._get_session_by_status_for_overview(
            projects, where, org_id, rollup, summary_start, now
        )
        rv_users = self._get_users_and_crashed_users_for_overview(
            projects, where, org_id, rollup, summary_start, now
        )

        # XXX: In order to be able to dual-read and compare results from both
        # old and new backend, this should really go back through the
        # release_health service instead of directly calling `self`. For now
        # that makes the entire backend too hard to test though.
        release_adoption = self.get_release_adoption(project_releases, environments)

        rv: dict[ProjectRelease, ReleaseHealthOverview] = {}

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

            total_users = rv_users.get((project_id, release, "all_users"))
            has_health_data = bool(total_sessions)

            # has_health_data is supposed to be irrespective of the currently
            # selected rollup window. Therefore we need to run another query
            # over 90d just to see if health data is available to compute
            # has_health_data correctly.
            if not has_health_data and summary_stats_period != "90d":
                fetch_has_health_data_releases.add((project_id, release))

            sessions_crashed = rv_sessions.get((project_id, release, "crashed"), 0)

            users_crashed = rv_users.get((project_id, release, "crashed_users"), 0)

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
            has_health_data = self.check_has_health_data(fetch_has_health_data_releases)  # type: ignore[assignment]

            for key in fetch_has_health_data_releases:
                rv[key]["has_health_data"] = key in has_health_data  # type: ignore[operator]

        return rv

    def _get_crash_free_breakdown_fn(
        self,
        org_id: int,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Sequence[EnvironmentName] | None = None,
    ) -> Callable[[datetime], CrashFreeBreakdown]:

        projects = self._get_projects([project_id])

        where = [
            Condition(
                lhs=Column(name="tags[release]"),
                op=Op.EQ,
                rhs=release,
            )
        ]

        if environments:
            environments = list(environments)
            where.append(
                Condition(
                    lhs=Column(name="tags[environment]"),
                    op=Op.IN,
                    rhs=environments,
                )
            )

        def query_stats(end: datetime) -> CrashFreeBreakdown:
            def _get_data(select: list[MetricField]) -> tuple[int, int]:
                query = DeprecatingMetricsQuery(
                    org_id=org_id,
                    project_ids=[project_id],
                    select=select,
                    start=start,
                    end=end,
                    where=where,
                    granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
                    include_series=False,
                    include_totals=True,
                )

                raw_result = get_series(
                    projects=projects,
                    metrics_query=query,
                    use_case_id=USE_CASE_ID,
                )

                groups = raw_result["groups"]
                assert len(groups) == 1

                totals = groups[0]["totals"]
                total = totals["total"]
                crashed = totals["crashed"]
                return total, crashed

            session_select = [
                MetricField(metric_mri=SessionMRI.ALL.value, alias="total", op=None),
                MetricField(metric_mri=SessionMRI.CRASH_FREE_RATE.value, alias="crashed", op=None),
            ]
            sessions_total, sessions_crashed_rate = _get_data(session_select)
            users_select = [
                MetricField(metric_mri=SessionMRI.ALL_USER.value, alias="total", op=None),
                MetricField(
                    metric_mri=SessionMRI.CRASH_FREE_USER_RATE.value, alias="crashed", op=None
                ),
            ]
            users_total, users_crashed_rate = _get_data(users_select)

            return {
                "date": end,
                "total_users": users_total,
                "crash_free_users": users_crashed_rate * 100 if users_total else None,
                "total_sessions": sessions_total,
                "crash_free_sessions": sessions_crashed_rate * 100 if sessions_total else None,
            }

        return query_stats

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Sequence[EnvironmentName] | None = None,
        now: datetime | None = None,
    ) -> Sequence[CrashFreeBreakdown]:

        projects, org_id = self._get_projects_and_org_id([project_id])

        if now is None:
            now = datetime.now(timezone.utc)

        query_fn = self._get_crash_free_breakdown_fn(
            org_id, project_id, release, start, environments
        )

        last: datetime | None = None
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
        project_ids: Iterable[int],
        now: datetime | None = None,
    ) -> Sequence[ProjectRelease]:

        if now is None:
            now = datetime.now(timezone.utc)

        start = now - timedelta(days=3)

        project_ids = list(project_ids)

        if len(project_ids) == 0:
            return []

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None)]

        groupby = [
            MetricGroupByField(field="release"),
            MetricGroupByField(field="project_id"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=now,
            groupby=groupby,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]

        ret_val = []
        for group in groups:
            by = group.get("by")
            ret_val.append((by.get("project_id"), by.get("release")))
        return ret_val

    def get_oldest_health_data_for_releases(
        self,
        project_releases: Sequence[ProjectRelease],
        now: datetime | None = None,
    ) -> Mapping[ProjectRelease, str]:
        if now is None:
            now = datetime.now(timezone.utc)

        # TODO: assumption about retention?
        start = now - timedelta(days=90)

        project_ids = [proj_id for proj_id, _release in project_releases]
        projects, org_id = self._get_projects_and_org_id(project_ids)

        where = [filter_releases_by_project_release(project_releases)]

        groupby = [
            MetricGroupByField(field="release"),
            MetricGroupByField(field="project_id"),
        ]
        select = [
            MetricField(
                metric_mri=SessionMRI.RAW_SESSION.value, alias="oldest", op="min_timestamp"
            ),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=now,
            groupby=groupby,
            where=where,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        ret_val = {}
        groups = raw_result["groups"]
        for group in groups:
            by = group.get("by")
            proj_id = by.get("project_id")
            release = by.get("release")
            totals = group.get("totals")
            ret_val[(proj_id, release)] = totals["oldest"]
        return ret_val

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: str | None = None,
        environments: Sequence[EnvironmentName] | None = None,
    ) -> int:

        projects = self._get_projects(project_ids)

        now = datetime.now(timezone.utc)

        if stats_period is None:
            stats_period = "24h"

        # Special rule that we support sorting by the last 24h only.
        if scope.endswith("_24h"):
            stats_period = "24h"

        granularity, stats_start, _ = get_rollup_starts_and_buckets(stats_period, now=now)

        where = []

        if environments is not None:
            where.append(Condition(Column("tags[environment]"), Op.IN, environments))

        if scope == "users":
            select = [MetricField(metric_mri=SessionMRI.ALL_USER.value, alias="v", op=None)]
        elif scope == "crash_free_users":
            select = [MetricField(metric_mri=SessionMRI.CRASH_FREE_USER.value, alias="v", op=None)]
        else:  # sessions
            select = [MetricField(metric_mri=SessionMRI.ALL.value, alias="v", op=None)]

        groupby = [
            MetricGroupByField(field="project_id"),
            MetricGroupByField(field="release"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=organization_id,
            project_ids=project_ids,
            select=select,
            start=stats_start,
            end=now,
            where=where,
            groupby=groupby,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]

        # since we are grouping by release & project the number of unique
        # combination is the number of groups.
        # NOTE: (RaduW) I don't know how to get a more direct query
        # the way it was in the original implementation where we
        # didn't use a group by  but calculated in one go with
        #  a column uniqueExact(projectId, release)
        ret_val = 0
        for group in groups:
            val = get_path(group, "totals", "v", default=0)
            if val > 0:
                ret_val += 1
        return ret_val

    def get_project_release_stats(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        stat: OverviewStat,
        rollup: int,
        start: datetime,
        end: datetime,
        environments: Sequence[EnvironmentName] | None = None,
    ) -> ProjectReleaseUserStats | ProjectReleaseSessionStats:
        assert stat in ("users", "sessions")

        projects, org_id = self._get_projects_and_org_id([project_id])

        start = to_datetime((start.timestamp() // rollup + 1) * rollup)

        # since snuba end queries are exclusive of the time and we're bucketing to
        # 10 seconds, we need to round to the next 10 seconds since snuba is
        # exclusive on the end.
        end = to_datetime(
            (end.timestamp() // SMALLEST_METRICS_BUCKET + 1) * SMALLEST_METRICS_BUCKET
        )

        where = [
            Condition(
                lhs=Column(name="tags[release]"),
                op=Op.EQ,
                rhs=release,
            )
        ]

        if environments is not None:
            where.append(Condition(Column("tags[environment]"), Op.IN, environments))

        if stat == "users":
            select = [
                MetricField(metric_mri=SessionMRI.ALL_USER.value, alias="users", op=None),
                MetricField(
                    metric_mri=SessionMRI.ABNORMAL_USER.value, alias="users_abnormal", op=None
                ),
                MetricField(
                    metric_mri=SessionMRI.CRASHED_USER.value, alias="users_crashed", op=None
                ),
                MetricField(
                    metric_mri=SessionMRI.ERRORED_USER.value, alias="users_errored", op=None
                ),
                MetricField(
                    metric_mri=SessionMRI.HEALTHY_USER.value, alias="users_healthy", op=None
                ),
            ]
        else:
            select = [
                MetricField(metric_mri=SessionMRI.ALL.value, alias="sessions", op=None),
                MetricField(
                    metric_mri=SessionMRI.ABNORMAL.value, alias="sessions_abnormal", op=None
                ),
                MetricField(metric_mri=SessionMRI.CRASHED.value, alias="sessions_crashed", op=None),
                MetricField(metric_mri=SessionMRI.ERRORED.value, alias="sessions_errored", op=None),
                MetricField(metric_mri=SessionMRI.HEALTHY.value, alias="sessions_healthy", op=None),
            ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=[project_id],
            select=select,
            start=start,
            end=end,
            where=where,
            granularity=Granularity(rollup),
            include_series=False,
            include_totals=True,
        )

        raw_totals = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        totals = raw_totals["groups"][0]["totals"]

        # we also need durations for series we also need durations p50 and p90
        select += [
            MetricField(metric_mri=SessionMRI.DURATION.value, alias="duration_p50", op="p50"),
            MetricField(metric_mri=SessionMRI.DURATION.value, alias="duration_p90", op="p90"),
        ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=[project_id],
            select=select,
            start=start,
            end=end,
            where=where,
            granularity=Granularity(rollup),
            include_series=True,
            include_totals=False,
        )

        raw_series = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_series["groups"]
        intervals = raw_series["intervals"]
        timestamps = [int(dt.timestamp()) for dt in intervals]

        if not groups:
            # no data create empty series
            empty_entry = {
                "duration_p50": None,
                "duration_p90": None,
                f"{stat}": 0,
                f"{stat}_abnormal": 0,
                f"{stat}_crashed": 0,
                f"{stat}_errored": 0,
                f"{stat}_healthy": 0,
            }

            # create [(timestamp_0, copy(empty_entry)),(timestamp_2, copy(empty_entry))...]
            ret_series = [(ts, {**empty_entry}) for ts in timestamps]
        else:
            series = groups[0]["series"]

            # massage series from { "healthy":[10,20], "errored":[1,2]}
            # to : [(timestamp_0, {"healthy":10, "errored":1}),(timestamp_2, {..}) ]
            ret_series = []
            for idx, timestamp in enumerate(timestamps):
                value = {}
                for key in series.keys():
                    value[key] = series[key][idx]
                ret_series.append((timestamp, value))

        return ret_series, totals  # type: ignore[return-value]

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: int | None = None,
    ) -> int:
        """
        Returns the number of sessions in the specified period (optionally
        filtered by environment)
        """
        projects, org_id = self._get_projects_and_org_id([project_id])

        select = [MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None)]

        where = []

        if environment_id is not None:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names = _model_environment_ids_to_environment_names([environment_id])
            env_name = env_names[environment_id]

            where.append(Condition(Column("tags[environment]"), Op.EQ, env_name))

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=[project_id],
            select=select,
            start=start,
            end=end,
            where=where,
            granularity=Granularity(rollup),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]
        if len(groups) > 0:
            return get_path(groups[0], "totals", "value", default=0)
        else:
            return 0

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime | None,
        end: datetime | None,
        environment_ids: Sequence[int] | None = None,
        rollup: int | None = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:

        projects, org_id = self._get_projects_and_org_id(project_ids)

        select = [MetricField(metric_mri=SessionMRI.ALL.value, alias="value", op=None)]

        where = []

        groupby = [
            MetricGroupByField(field="project_id"),
        ]

        if environment_ids is not None and len(environment_ids) > 0:
            # convert the PosgreSQL environmentID into the clickhouse string index
            # for the environment name
            env_names_dict = _model_environment_ids_to_environment_names(environment_ids)
            env_names = [value for value in env_names_dict.values() if value is not None]
            where.append(
                Condition(
                    lhs=Column(name="tags[environment]"),
                    op=Op.IN,
                    rhs=env_names,
                )
            )

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=start,
            end=end,
            where=where,
            groupby=groupby,
            granularity=Granularity(rollup),
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )
        ret_val = [
            (get_path(group, "by", "project_id"), get_path(group, "totals", "value"))
            for group in raw_result["groups"]
        ]
        return ret_val

    def get_project_releases_by_stability(
        self,
        project_ids: Sequence[ProjectId],
        offset: int | None,
        limit: int | None,
        scope: str,
        stats_period: str | None = None,
        environments: Sequence[str] | None = None,
        now: datetime | None = None,
    ) -> Sequence[ProjectRelease]:

        if len(project_ids) == 0:
            return []

        projects, org_id = self._get_projects_and_org_id(project_ids)

        where = []

        if environments is not None:
            where.append(Condition(Column("tags[environment]"), Op.IN, environments))

        if stats_period is None:
            stats_period = "24h"

        # Special rule that we support sorting by the last 24h only.
        if scope.endswith("_24h"):
            scope = scope[:-4]
            stats_period = "24h"

        if now is None:
            now = datetime.now(timezone.utc)

        granularity, stats_start, _ = get_rollup_starts_and_buckets(stats_period, now=now)

        groupby = [
            MetricGroupByField(field="project_id"),
            MetricGroupByField(field="release"),
        ]

        if scope == "crash_free_sessions":
            select = [
                MetricField(metric_mri=SessionMRI.ALL.value, op=None),
                MetricField(metric_mri=SessionMRI.CRASH_RATE.value, op=None),
            ]
            orderby = [
                MetricOrderByField(
                    MetricField(metric_mri=SessionMRI.CRASH_RATE.value, op=None),
                    direction=Direction.DESC,
                )
            ]
        elif scope == "sessions":
            select = [MetricField(metric_mri=SessionMRI.ALL.value, op=None)]
            orderby = [
                MetricOrderByField(
                    MetricField(metric_mri=SessionMRI.ALL.value, op=None), direction=Direction.DESC
                )
            ]
        elif scope == "crash_free_users":
            select = [
                MetricField(metric_mri=SessionMRI.ALL_USER.value, op=None),
                MetricField(metric_mri=SessionMRI.CRASH_USER_RATE.value, op=None),
            ]
            orderby = [
                MetricOrderByField(
                    MetricField(metric_mri=SessionMRI.CRASH_USER_RATE.value, op=None),
                    direction=Direction.DESC,
                )
            ]
        else:  # users
            assert scope == "users"
            select = [MetricField(metric_mri=SessionMRI.ALL_USER.value, op=None)]
            orderby = [
                MetricOrderByField(
                    MetricField(metric_mri=SessionMRI.ALL_USER.value, op=None),
                    direction=Direction.DESC,
                )
            ]

        query = DeprecatingMetricsQuery(
            org_id=org_id,
            project_ids=project_ids,
            select=select,
            start=stats_start,
            end=now,
            where=where,
            orderby=orderby,
            groupby=groupby,
            granularity=Granularity(LEGACY_SESSIONS_DEFAULT_ROLLUP),
            offset=Offset(offset) if offset is not None else None,
            limit=Limit(limit) if limit is not None else None,
            include_series=False,
            include_totals=True,
        )

        raw_result = get_series(
            projects=projects,
            metrics_query=query,
            use_case_id=USE_CASE_ID,
        )

        groups = raw_result["groups"]
        ret_val = []

        for group in groups:
            by = group.get("by")
            ret_val.append((by["project_id"], by["release"]))

        return ret_val
