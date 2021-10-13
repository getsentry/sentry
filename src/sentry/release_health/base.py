from datetime import datetime
from typing import Mapping, Optional, Sequence, Set, Tuple, TypeVar, Union

from typing_extensions import Literal, TypedDict

from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.services import Service

ProjectId = int
OrganizationId = int
ReleaseName = str
EnvironmentName = str
DateString = str

#: The functions supported by `run_sessions_query`
SessionsQueryFunction = Literal[
    "sum(session)",
    "count_unique(user)",
    "avg(session.duration)",
    "p50(session.duration)",
    "p75(session.duration)",
    "p90(session.duration)",
    "p95(session.duration)",
    "p99(session.duration)",
    "max(session.duration)",
]

GroupByFieldName = Literal[
    "project",
    "release",
    "environment",
    "session.status",
]
FilterFieldName = Literal["project", "release", "environment"]


class SessionsQuery(TypedDict):
    org_id: OrganizationId
    project_ids: Sequence[ProjectId]
    select_fields: Sequence[SessionsQueryFunction]
    filter_query: Mapping[FilterFieldName, str]
    start: datetime
    end: datetime
    rollup: int  # seconds


SessionsQueryValue = Union[None, float, int]

ProjectWithCount = Tuple[ProjectId, int]


class SessionsQueryGroup(TypedDict):
    by: Mapping[GroupByFieldName, Union[str, int]]
    series: Mapping[SessionsQueryFunction, Sequence[SessionsQueryValue]]
    totals: Mapping[SessionsQueryFunction, SessionsQueryValue]


class SessionsQueryResult(TypedDict):
    start: DateString
    end: DateString
    intervals: Sequence[DateString]
    groups: Sequence[SessionsQueryGroup]
    query: str


FormattedIsoTime = str

ProjectRelease = Tuple[ProjectId, ReleaseName]
ProjectOrRelease = TypeVar("ProjectOrRelease", ProjectId, ProjectRelease)

# taken from sentry.snuba.sessions.STATS_PERIODS
StatsPeriod = Literal[
    "1h",
    "24h",
    "1d",
    "48h",
    "2d",
    "7d",
    "14d",
    "30d",
    "90d",
]

OverviewStat = Literal["users", "sessions"]


class CurrentAndPreviousCrashFreeRate(TypedDict):
    currentCrashFreeRate: Optional[float]
    previousCrashFreeRate: Optional[float]


CurrentAndPreviousCrashFreeRates = Mapping[ProjectId, CurrentAndPreviousCrashFreeRate]


class _TimeBounds(TypedDict):
    sessions_lower_bound: FormattedIsoTime
    sessions_upper_bound: FormattedIsoTime


class _NoTimeBounds(TypedDict):
    sessions_lower_bound: None
    sessions_upper_bound: None


ReleaseSessionsTimeBounds = Union[_TimeBounds, _NoTimeBounds]

# Inner list is supposed to be fixed length
ReleaseHealthStats = Sequence[Sequence[int]]


class ReleaseAdoption(TypedDict):
    #: Adoption rate (based on usercount) for a project's release from 0..100
    adoption: Optional[float]
    #: Adoption rate (based on sessioncount) for a project's release from 0..100
    sessions_adoption: Optional[float]
    #: User count for a project's release (past 24h)
    users_24h: Optional[int]
    #: Sessions count for a project's release (past 24h)
    sessions_24h: Optional[int]
    #: Sessions count for the entire project (past 24h)
    project_users_24h: Optional[int]
    #: Sessions count for the entire project (past 24h)
    project_sessions_24h: Optional[int]


ReleasesAdoption = Mapping[Tuple[ProjectId, ReleaseName], ReleaseAdoption]


class ReleaseHealthOverview(TypedDict, total=False):
    adoption: Optional[float]
    sessions_adoption: Optional[float]
    total_users_24h: Optional[int]
    total_project_users_24h: Optional[int]
    total_sessions_24h: Optional[int]
    total_project_sessions_24h: Optional[int]
    total_sessions: Optional[int]
    total_users: Optional[int]
    has_health_data: bool
    sessions_crashed: int
    crash_free_users: Optional[float]
    crash_free_sessions: Optional[float]
    sessions_errored: int
    duration_p50: Optional[float]
    duration_p90: Optional[float]
    stats: Mapping[StatsPeriod, ReleaseHealthStats]


class CrashFreeBreakdown(TypedDict):
    date: datetime
    total_users: int
    crash_free_users: Optional[float]
    total_sessions: int
    crash_free_sessions: Optional[float]


class ReleaseHealthBackend(Service):  # type: ignore
    """Abstraction layer for all release health related queries"""

    __all__ = (
        "get_current_and_previous_crash_free_rates",
        "get_release_adoption",
        "check_has_health_data",
        "get_release_sessions_time_bounds",
        "check_releases_have_health_data",
        "run_sessions_query",
        "get_release_health_data_overview",
        "get_crash_free_breakdown",
        "get_changed_project_release_model_adoptions",
        "get_oldest_health_data_for_releases",
        "get_project_releases_count",
        "get_project_sessions_count",
        "get_num_sessions_per_project",
    )

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
        """
        Function that returns `currentCrashFreeRate` and the `previousCrashFreeRate` of projects
        based on the inputs provided
        Inputs:
            * project_ids
            * current_start: start interval of currentCrashFreeRate
            * current_end: end interval of currentCrashFreeRate
            * previous_start: start interval of previousCrashFreeRate
            * previous_end: end interval of previousCrashFreeRate
            * rollup
        Returns:
            A dictionary of project_id as key and as value the `currentCrashFreeRate` and the
            `previousCrashFreeRate`

            As an example:
            {
                1: {
                    "currentCrashFreeRate": 100,
                    "previousCrashFreeRate": 66.66666666666667
                },
                2: {
                    "currentCrashFreeRate": 50.0,
                    "previousCrashFreeRate": None
                },
                ...
            }
        """
        raise NotImplementedError()

    def get_release_adoption(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        now: Optional[datetime] = None,
        org_id: Optional[OrganizationId] = None,
    ) -> ReleasesAdoption:
        """
        Get the adoption of the last 24 hours (or a difference reference timestamp).

        :param project_releases: A list of releases to get adoption for. Our
            backends store session data per-project, so each release has to be
            scoped down to a project too.

        :param environments: Optional. A list of environments to filter by.
        :param now: Release adoption information will be provided from 24h ago
            until this timestamp.
        :param org_id: An organization ID to filter by. Note that all projects
            have to be within this organization, and this backend doesn't check for
            that. Omit if you're not sure.
        """

        raise NotImplementedError()

    def run_sessions_query(
        self,
        org_id: int,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        """
        Runs the `query` as defined by the sessions_v2 [`QueryDefinition`],
        and returns the resulting timeseries in sessions_v2 format.
        """
        raise NotImplementedError()

    def get_release_sessions_time_bounds(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        org_id: OrganizationId,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> ReleaseSessionsTimeBounds:
        """
        Get the sessions time bounds in terms of when the first session started and
        when the last session started according to a specific (project_id, org_id, release, environments)
        combination
        Inputs:
            * project_id
            * release
            * org_id: Organisation Id
            * environments
        Return:
            Dictionary with two keys "sessions_lower_bound" and "sessions_upper_bound" that
        correspond to when the first session occurred and when the last session occurred respectively
        """
        raise NotImplementedError()

    def check_has_health_data(
        self, projects_list: Sequence[ProjectOrRelease]
    ) -> Set[ProjectOrRelease]:
        """
        Function that returns a set of all project_ids or (project, release) if they have health data
        within the last 90 days based on a list of projects or a list of project, release combinations
        provided as an arg.
        Inputs:
            * projects_list: Contains either a list of project ids or a list of tuple (project_id,
            release)
        """
        raise NotImplementedError()

    def check_releases_have_health_data(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        release_versions: Sequence[ReleaseName],
        start: datetime,
        end: datetime,
    ) -> Set[ReleaseName]:
        """
        Returns a set of all release versions that have health data within a given period of time.
        """

        raise NotImplementedError()

    def get_release_health_data_overview(
        self,
        project_releases: Sequence[ProjectRelease],
        environments: Optional[Sequence[EnvironmentName]] = None,
        summary_stats_period: Optional[StatsPeriod] = None,
        health_stats_period: Optional[StatsPeriod] = None,
        stat: Optional[OverviewStat] = None,
    ) -> Mapping[ProjectRelease, ReleaseHealthOverview]:
        """Checks quickly for which of the given project releases we have
        health data available.  The argument is a tuple of `(project_id, release_name)`
        tuples.  The return value is a set of all the project releases that have health
        data.
        """

        raise NotImplementedError()

    def get_crash_free_breakdown(
        self,
        project_id: ProjectId,
        release: ReleaseName,
        start: datetime,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> Sequence[CrashFreeBreakdown]:
        """Get stats about crash free sessions and stats for the last 1, 2, 7, 14 and 30 days"""

    def get_changed_project_release_model_adoptions(
        self,
        project_ids: Sequence[ProjectId],
    ) -> Sequence[ProjectRelease]:
        """
        Returns a sequence of tuples (ProjectId, ReleaseName) with the
        releases seen in the last 72 hours for the requested projects.
        """
        raise NotImplementedError()

    def get_oldest_health_data_for_releases(
        self, project_releases: Sequence[ProjectRelease]
    ) -> Mapping[ProjectRelease, str]:
        """Returns the oldest health data we have observed in a release
        in 90 days.  This is used for backfilling.
        """
        raise NotImplementedError()

    def get_project_releases_count(
        self,
        organization_id: OrganizationId,
        project_ids: Sequence[ProjectId],
        scope: str,
        stats_period: Optional[str] = None,
        environments: Optional[Sequence[EnvironmentName]] = None,
    ) -> int:
        """
        Fetches the total count of releases/project combinations
        """
        raise NotImplementedError()

    def get_project_sessions_count(
        self,
        project_id: ProjectId,
        rollup: int,  # rollup in seconds
        start: datetime,
        end: datetime,
        environment_id: Optional[int] = None,
    ) -> int:
        """
        Returns the number of sessions in the specified period (optionally
        filtered by environment)
        """
        raise NotImplementedError()

    def get_num_sessions_per_project(
        self,
        project_ids: Sequence[ProjectId],
        start: datetime,
        end: datetime,
        environment_ids: Optional[Sequence[int]] = None,
        rollup: Optional[int] = None,  # rollup in seconds
    ) -> Sequence[ProjectWithCount]:
        """
        Returns the number of sessions for each project specified.
        Additionally
        """
        raise NotImplementedError()
