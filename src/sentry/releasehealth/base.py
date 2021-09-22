from datetime import datetime
from typing import Mapping, Optional, Sequence, Tuple

from typing_extensions import Literal, TypedDict

from sentry.snuba.sessions_v2 import QueryDefinition
from sentry.utils.services import Service

ProjectId = int
OrganizationId = int
ReleaseName = str
EnvironmentName = str

SelectField = Literal[
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

GroupByField = Literal[
    "project",
    "release",
    "environment",
    "session.status",
]
FilterField = Literal["project", "release", "environment"]


class SessionsQuery(TypedDict):
    org_id: OrganizationId
    project_ids: Sequence[ProjectId]
    select_fields: Sequence[SelectField]
    filter_query: Mapping[FilterField, str]
    start: datetime
    end: datetime
    rollup: int  # seconds


class SessionsQueryGroup(TypedDict):
    by: Mapping[GroupByField, str]
    series: Mapping[SelectField, Sequence[float]]
    totals: Mapping[SelectField, float]


class ReleaseHealthBackend(Service):  # type: ignore
    """Abstraction layer for all release health related queries"""

    __all__ = (
        "get_current_and_previous_crash_free_rates",
        "get_release_adoption",
        "run_sessions_query",
    )

    class CurrentAndPreviousCrashFreeRate(TypedDict):
        currentCrashFreeRate: Optional[float]
        previousCrashFreeRate: Optional[float]

    CurrentAndPreviousCrashFreeRates = Mapping[ProjectId, CurrentAndPreviousCrashFreeRate]

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

    class SessionsQueryResult(TypedDict):
        intervals: Sequence[datetime]
        groups: Sequence[SessionsQueryGroup]

    def run_sessions_query(
        self,
        query: QueryDefinition,
        span_op: str,
    ) -> SessionsQueryResult:
        raise NotImplementedError()
