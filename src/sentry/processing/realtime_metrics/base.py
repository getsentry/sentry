from collections import namedtuple
from typing import Iterable, Set, Union

from sentry.utils.services import Service

BucketedCount = namedtuple("BucketedCount", ["timestamp", "count"])


class RealtimeMetricsStore(Service):  # type: ignore
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = (
        "increment_project_event_counter",
        "increment_project_duration_counter",
        "validate",
        "get_lpq_projects",
        "add_project_to_lpq",
        "remove_projects_from_lpq",
    )

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event
        in seconds since the UNIX epoch (i.e., as returned by time.time()).
        """
        pass

    def increment_project_duration_counter(
        self, project_id: int, timestamp: int, duration: int
    ) -> None:
        """Increments the duration counter for the given project_id and duration.

        The counter is used to track the processing time of events for the project.
        Calling this increments the counter of the current time-window bucket with "timestamp" providing
        the time of the event in seconds since the UNIX epoch and "duration" the processing time in seconds.
        """
        pass

    def get_lpq_candidates(self) -> Iterable[int]:
        """
        Returns IDs of all projects that should be considered for the low priority queue.
        """

    def get_bucketed_counts_for_project(self, project_id: int) -> Iterable[BucketedCount]:
        """
        Returns a sorted list of timestamps (bucket size unknown) and the count of symbolicator
        requests made during that timestamp for some given project.
        """

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.
        """
        pass

    def add_project_to_lpq(self, project_id: int) -> None:
        """
        Moves a project to the low priority queue.

        This forces all symbolication events triggered by the specified project to be redirected to
        the low priority queue, unless the project is manually excluded from the low priority queue
        via the `store.symbolicate-event-lpq-never` kill switch.
        """
        pass

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> None:
        """
        Removes projects from the low priority queue.

        This restores all specified projects back to the regular queue, unless they have been
        manually forced into the low priority queue via the `store.symbolicate-event-lpq-always`
        kill switch.
        """
        pass
