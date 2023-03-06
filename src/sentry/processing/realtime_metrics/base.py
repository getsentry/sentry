from typing import Iterable, Set

from sentry.utils.services import Service


class RealtimeMetricsStore(Service):
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = (
        "validate",
        "record_project_duration",
        "projects",
        "get_used_budget_for_project",
        "get_lpq_projects",
        "is_lpq_project",
        "add_project_to_lpq",
        "remove_projects_from_lpq",
    )

    def record_project_duration(self, project_id: int, duration: float) -> None:
        """
        Records the duration of a symbolication request for the given project_id.

        The duration (from the start of the symbolication request)
        should be recorded at regular intervals *as the event is being processed*.

        The duration is used to track the used "symbolication time budget" of a project.
        Each project is allocated a certain per-second budget.
        If that budget is exceeded, the project will be demoted to the low priority queue.

        This can happen when a project either submits *a lot* of fast events,
        or a few *very slow* events.

        As the running duration is recorded at regular intervals,
        it naturally forms a quadratic function:

        Assuming we record at 1-second intervals and the request took 5 seconds
        in total, the used budget is:

        1 + 2 + 3 + 4 + 5 = 15

        In general, a request that takes n seconds to symbolicate will cost
        1 + 2 + … + n = n * (n+1) / 2 = O(n²) time units.

        This method will "punish" slow events in particular, as our main goal is
        to maintain throughput with limited concurrency.
        """
        raise NotImplementedError

    def projects(self) -> Iterable[int]:
        """
        Returns IDs of all projects that should be considered for the low priority queue.
        """
        raise NotImplementedError

    def get_used_budget_for_project(self, project_id: int) -> float:
        """
        Returns the average used per-second budget for a given project during the configured sliding time window.
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
