from typing import Mapping, Sequence

from sentry.utils.services import Service


class BaseReleaseMonitorBackend(Service):
    CHUNK_SIZE = 1000
    MAX_SECONDS = 60

    __all__ = ("fetch_projects_with_recent_sessions",)

    def fetch_projects_with_recent_sessions(self) -> Mapping[int, Sequence[int]]:
        """
        Fetches all projects that have had session data in the last 6 hours, grouped by
        organization_id. Returned as a dict in format {organization_id: <list of project ids>}.
        """
        raise NotImplementedError
