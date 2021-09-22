from typing import Union

from sentry.utils.services import Service


class RealtimeMetricsStore(Service):  # type: ignore
    """A service for storing metrics about incoming requests within a given time window."""

    __all__ = ("increment_project_event_counter", "validate")

    def increment_project_event_counter(
        self, project_id: int, timestamp: Union[int, float]
    ) -> None:
        """Increment the event counter for the given project_id.

        The counter is used to track the rate of events for the project.
        Calling this increments the counter of the current
        time-window bucket with "timestamp" providing the time of the event.
        """
        pass

    def increment_project_duration_counter(
        self, project_id: int, timestamp: Union[int, float], duration: Union[int, float]
    ) -> None:
        """Increments the duration counter for the given project_id and duration.

        The counter is used to track the processing time of events for the project.
        Calling this increments the counter of the current time-window bucket with "timestamp" providing
        the time of the event and "duration" the processing time.
        """
        pass
