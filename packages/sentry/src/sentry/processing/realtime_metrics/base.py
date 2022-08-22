import collections
import dataclasses
import enum
from typing import ClassVar, DefaultDict, Iterable, List, Set, Union

from sentry.utils.services import Service


class _Period(enum.Enum):
    """An enum to represent a singleton, for mypy's sake."""

    TOTAL_PERIOD = 0


@dataclasses.dataclass(frozen=True)
class BucketedCounts:
    """A count of something which occurred inside a certain timespan.

    The timespan is further split up in multiple buckets of ``width`` seconds each.
    ``timestamp`` denotes the POSIX timestamp of the start of the first bucket.
    """

    timestamp: int
    width: int
    counts: List[int]

    TOTAL_PERIOD: ClassVar[_Period] = _Period.TOTAL_PERIOD

    def total_time(self) -> int:
        """Returns the total timespan covered by all buckets in seconds."""
        return self.width * len(self.counts)

    def total_count(self) -> int:
        """Returns the sum of the counts in all the buckets."""
        return sum(self.counts)

    def rate(self, period: Union[int, _Period] = TOTAL_PERIOD) -> float:
        """Computes the rate of counts in the buckets for the given period.

        The period must either be the special value :attr:`BucketedCounts.TOTAL_PERIOD` or a
        number of seconds.  In the latter case the rate of the most recent number of seconds
        will be computed.

        :raises ValueError: if the given number of seconds is smaller than the
           :attr:`BucketedCounts.width`.
        """
        if period is self.TOTAL_PERIOD:
            timespan = self.total_time()
        else:
            if period < self.width:
                raise ValueError(
                    f"Buckets of {self.width}s are too small to compute rate over {period}s"
                )
            if period > self.total_time():
                raise ValueError("Can not compute rate over period longer than total_time")
            timespan = period
        bucket_count = int(timespan / self.width)
        return sum(self.counts[-bucket_count:]) / timespan


class DurationsHistogram:
    """A histogram with fixed bucket sizes.

    :ivar bucket_size: the size of the buckets in the histogram.

    The counters are stored in a sparse dict, with the keys being the start of a bucket
    duration, so e.g. with a bucket_size of ``10`` key ``30`` would cover durations in the
    range [30, 40).

    TODO: Not sure how much we gain from being sparse, maybe not being sparse and using a
       list as storage is more efficient.
    """

    def __init__(self, bucket_size: int = 10):
        self.bucket_size = bucket_size
        self._data: DefaultDict[int, int] = collections.defaultdict(lambda: 0)

    def incr(self, duration: int, count: int = 1) -> None:
        """Increments the histogram counter of the bucket in which `duration` falls."""
        bucket_key = duration - (duration % self.bucket_size)
        self._data[bucket_key] += count

    def incr_from(self, other: "DurationsHistogram") -> None:
        """Add the counts from another histogram to this one.

        The bucket_size must match.
        """
        assert self.bucket_size == other.bucket_size
        for key, count in other._data.items():
            self._data[key] += count

    def percentile(self, percentile: float) -> int:
        """Returns the requested percentile of the histogram.

        The percentile should be expressed as a number between 0 and 1, i.e. 0.75 is the
        75th percentile.
        """
        required_count = percentile * self.total_count()
        running_count = 0
        for (duration, count) in self._data.items():
            running_count += count
            if running_count >= required_count:
                return duration
        else:
            raise ValueError("Failed to compute percentile")

    def total_count(self) -> int:
        """Returns the sum of the counts of all the buckets in the histogram."""
        return sum(self._data.values())

    def __repr__(self) -> str:
        return f"<DurationsHistogram [{sorted(self._data.items())}]>"


@dataclasses.dataclass(frozen=True)
class BucketedDurationsHistograms:
    """histograms of counters for a certain timespan.

    The timespan is split up in multiple buckets of ``width`` seconds, with ``timestamp``
    denoting the POSIX timestamp of the start of the first bucket.  Each bucket contains a
    :class:`DurationHistogram`.
    """

    timestamp: int
    width: int
    histograms: List[DurationsHistogram]

    def total_time(self) -> int:
        """Returns the total timespan covered by the buckets in seconds."""
        return self.width * len(self.histograms)


class RealtimeMetricsStore(Service):
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = (
        "validate",
        "increment_project_event_counter",
        "increment_project_duration_counter",
        "projects",
        "get_counts_for_project",
        "get_durations_for_project",
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
        raise NotImplementedError

    def increment_project_duration_counter(
        self, project_id: int, timestamp: int, duration: int
    ) -> None:
        """Increments the duration counter for the given project_id and duration.

        The counter is used to track the processing time of events for the project.
        Calling this increments the counter of the current time-window bucket with "timestamp" providing
        the time of the event in seconds since the UNIX epoch and "duration" the processing time in seconds.
        """
        raise NotImplementedError

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects that should be considered for the low priority queue.
        """
        raise NotImplementedError

    def get_counts_for_project(self, project_id: int, timestamp: int) -> BucketedCounts:
        """
        Returns a sorted list of bucketed timestamps paired with the count of symbolicator requests
        made during that time for some given project.
        """
        raise NotImplementedError

    def get_durations_for_project(
        self, project_id: int, timestamp: int
    ) -> BucketedDurationsHistograms:
        """
        Returns a sorted list of bucketed timestamps paired with a histogram-like dictionary of
        symbolication durations made during some timestamp for some given project.

        For a given `{duration:count}` entry in the dictionary bound to a specific `timestamp`:

        - `duration` represents the amount of time it took for a symbolication request to complete.
        Durations are bucketed by 10secs, meaning that a `duration` of `30` covers all requests that
        took between 30-39 seconds.

        - `count` is the number of symbolication requests that took some amount of time within the
        range of `[duration, duration+10)` to complete.
        """
        raise NotImplementedError

    def get_lpq_projects(self) -> Set[int]:
        """
        Fetches the list of projects that are currently using the low priority queue.

        Returns a list of project IDs.
        """
        raise NotImplementedError

    def is_lpq_project(self, project_id: int) -> bool:
        """
        Checks whether the given project is currently using the low priority queue.
        """
        raise NotImplementedError

    def add_project_to_lpq(self, project_id: int) -> bool:
        """
        Assigns a project to the low priority queue.

        This registers an intent to redirect all symbolication events triggered by the specified
        project to be redirected to the low priority queue.

        Applies a backoff timer to the project which prevents it from being automatically evicted
        from the queue while that timer is active.

        Returns True if the project was a new addition to the list. Returns False if it was already
        assigned to the low priority queue. This may throw an exception if there is some sort of
        issue registering the project with the queue.
        """
        raise NotImplementedError

    def remove_projects_from_lpq(self, project_ids: Set[int]) -> int:
        """
        Unassigns projects from the low priority queue.

        This registers an intent to restore all specified projects back to the regular queue.

        Applies a backoff timer to the project which prevents it from being automatically assigned
        to the queue while that timer is active.

        Returns the number of projects that were actively removed from the queue. Any projects that
        were not assigned to the low priority queue to begin with will be omitted from the return
        value. This may throw an exception if there is some sort of issue deregistering the projects
        from the queue.
        """
        raise NotImplementedError
