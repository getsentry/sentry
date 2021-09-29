import dataclasses
from typing import Dict, Iterable, NewType, Set

from sentry.utils.services import Service


@dataclasses.dataclass(frozen=True)
class BucketedCount:
    """
    Timestamp to count mapping. This represents some `count` amount of something performed
    during `timestamp`. `timestamp` is stored in seconds.
    """

    timestamp: int
    count: int


# Duration to count mapping where the keys are durations and the values are counts. This represents
# some `count` instances of some action where each individual instance some
# [`duration`, `duration`+10) seconds of time to complete. `duration` is stored in seconds.
BucketedDurations = NewType("BucketedDurations", Dict[int, int])


@dataclasses.dataclass(frozen=True)
class DurationHistogram:
    """
    Mapping of timestamp to histogram-like dict of durations. This represents some `count` amount of
    some action performed during `timestamp`, where `counts` are grouped by how long that action
    took. `timestamp` is stored in seconds.
    """

    timestamp: int
    histogram: BucketedDurations


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

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects that should be considered for the low priority queue.
        """
        pass

    def get_counts_for_project(self, project_id: int) -> Iterable[BucketedCount]:
        """
        Returns a sorted list of bucketed timestamps paired with the count of symbolicator requests
        made during that time for some given project.
        """
        pass

    def get_durations_for_project(self, project_id: int) -> Iterable[DurationHistogram]:
        """
        Returns a sorted list of bucketed timestamps paired with a dictionary of symbolicator
        durations grouped in 10 second durations made during that time for some given project.
        """
        pass

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.
        """
        pass

    def add_project_to_lpq(self, project_id: int) -> bool:
        """
        Moves a project to the low priority queue.

        This forces all symbolication events triggered by the specified project to be redirected to
        the low priority queue, unless the project is manually excluded from the low priority queue
        via the `store.symbolicate-event-lpq-never` kill switch.

        Returns True if the project was a new addition to the list. Returns False if it was already
        assigned to the low priority queue.
        """
        pass

    def remove_project_from_lpq(self, project_id: int) -> bool:
        """
        Removes a project from the low priority queue.

        This restores the specified project back to the regular queue, unless it has been
        manually forced into the low priority queue via the `store.symbolicate-event-lpq-always`
        kill switch.

        Returns True if the project was assigned to the queue prior to its removal. Returns False if
        it wasn't assigned to the queue to begin with.
        """
        pass

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        """
        Removes projects from the low priority queue.

        This restores all specified projects back to the regular queue, unless they have been
        manually forced into the low priority queue via the `store.symbolicate-event-lpq-always`
        kill switch.

        Returns the number of projects that were actively removed from the queue. Any projects that
        were not assigned to the low priority queue to begin with will be omitted from the return
        value.
        """
        pass
