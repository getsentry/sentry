from sentry.utils.services import Service


class RealtimeMetricsStore(Service):  # type: ignore
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = ("increment_project_event_counter", "validate")

    def increment_project_event_counter(self, project_id: int, timestamp: int) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event
        in seconds since the UNIX epoch (i.e., as returned by time.time()).
        """
        pass
