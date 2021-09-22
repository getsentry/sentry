from sentry.utils.services import Service


class RealtimeMetricsStore(Service):  # type: ignore
    __all__ = ("increment_project_event_counter", "validate")

    def increment_project_event_counter(self, project_id: int, timestamp: float) -> None:
        """Increment the event counter for the given project_id.

        The key is computed from the project_id and the timestamp of the symbolication request, rounded
        down to this object's bucket size. If the key is not currently set to expire, it will be set to expire
        in ttl seconds.
        """
        pass
