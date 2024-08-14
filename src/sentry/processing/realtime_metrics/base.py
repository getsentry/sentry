from sentry.lang.native.symbolicator import SymbolicatorPlatform
from sentry.utils.services import Service


class RealtimeMetricsStore(Service):
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = (
        "validate",
        "record_project_duration",
        "is_lpq_project",
    )

    def validate(self) -> None:
        """
        Validate the current state of the metrics store.
        """
        raise NotImplementedError

    def record_project_duration(
        self, platform: SymbolicatorPlatform, project_id: int, duration: float
    ) -> None:
        """
        Records the duration of a symbolication request for the given project_id and platform.

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

    def is_lpq_project(self, platform: SymbolicatorPlatform, project_id: int) -> bool:
        """
        Checks whether the given project is currently using the low priority queue for
        the given platform.
        """
        raise NotImplementedError
