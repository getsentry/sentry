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


SelectFieldName = Literal[
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
    select_fields: Sequence[SelectFieldName]
    filter_query: Mapping[FilterFieldName, str]
    start: datetime
    end: datetime
    rollup: int  # seconds


SessionsQueryValue = Union[None, float, int]


class SessionsQueryGroup(TypedDict):
    by: Mapping[GroupByFieldName, Union[str, int]]
    series: Mapping[SelectFieldName, Sequence[SessionsQueryValue]]
    totals: Mapping[SelectFieldName, SessionsQueryValue]


class SessionsQueryResult(TypedDict):
    start: DateString
    end: DateString
    intervals: Sequence[DateString]
    groups: Sequence[SessionsQueryGroup]
    query: str


ProjectRelease = Tuple[ProjectId, ReleaseName]

ProjectOrRelease = TypeVar("ProjectOrRelease", ProjectId, ProjectRelease)


class CurrentAndPreviousCrashFreeRate(TypedDict):
    currentCrashFreeRate: Optional[float]
    previousCrashFreeRate: Optional[float]


CurrentAndPreviousCrashFreeRates = Mapping[ProjectId, CurrentAndPreviousCrashFreeRate]


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


class ReleaseHealthBackend(Service):  # type: ignore
    """Abstraction layer for all release health related queries"""

    __all__ = (
        "get_current_and_previous_crash_free_rates",
        "get_release_adoption",
        "check_has_health_data",
        "check_releases_have_health_data",
        "run_sessions_query",
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
        project_releases: Sequence[Tuple[ProjectId, ReleaseName]],
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
