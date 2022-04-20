from typing import Dict, Mapping, Sequence, TypedDict

from sentry.utils.services import Service


class EnvironmentTotals(TypedDict):
    total_sessions: int
    releases: Dict[str, int]


Totals = Dict[int, Dict[str, EnvironmentTotals]]


class BaseReleaseMonitorBackend(Service):
    CHUNK_SIZE = 1000
    MAX_SECONDS = 60

    __all__ = ("fetch_projects_with_recent_sessions", "fetch_project_release_health_totals")

    def fetch_projects_with_recent_sessions(self) -> Mapping[int, Sequence[int]]:
        """
        Fetches all projects that have had session data in the last 6 hours, grouped by
        organization_id. Returned as a dict in format {organization_id: <list of project ids>}.
        """
        raise NotImplementedError

    def fetch_project_release_health_totals(
        self, org_id: int, project_ids: Sequence[int]
    ) -> Totals:
        """
        Fetches release health totals for the passed project_ids, which must be related to the
        passed org id.
        """
        raise NotImplementedError
