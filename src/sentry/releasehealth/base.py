from datetime import datetime
from typing import Mapping, Optional, Sequence, Set, Tuple, TypeVar, Union

from typing_extensions import TypedDict

from sentry.utils.services import Service

ProjectId = int
OrganizationId = int
ReleaseName = str
EnvironmentName = str
FormattedIsoTime = str

ProjectRelease = Tuple[ProjectId, ReleaseName]
ProjectOrRelease = TypeVar("ProjectOrRelease", ProjectId, ProjectRelease)


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


class ReleaseHealthBackend(Service):  # type: ignore
    """Abstraction layer for all release health related queries"""

    __all__ = (
        "get_current_and_previous_crash_free_rates",
        "get_release_adoption",
        "check_has_health_data",
        "get_release_sessions_time_bounds",
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
