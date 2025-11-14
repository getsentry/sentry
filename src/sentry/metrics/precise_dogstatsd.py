import atexit
from typing import int, Any

from datadog.dogstatsd.base import DogStatsd

from .base import MetricsBackend, Tags

__all__ = ["PreciseDogStatsdMetricsBackend"]


class PreciseDogStatsdMetricsBackend(MetricsBackend):
    def __init__(self, prefix: str | None = None, **kwargs: Any) -> None:
        self.tags = kwargs.pop("tags", None)

        instance_kwargs: dict[str, Any] = {
            "disable_telemetry": True,
            "disable_buffering": False,
            # When enabled, a background thread will be used to send metric payloads to the Agent.
            "disable_background_sender": False,
        }
        if socket_path := kwargs.get("statsd_socket_path"):
            instance_kwargs["socket_path"] = socket_path
        else:
            if host := kwargs.get("statsd_host"):
                instance_kwargs["host"] = host
            if port := kwargs.get("statsd_port"):
                instance_kwargs["port"] = int(port)

        self.statsd = DogStatsd(**instance_kwargs)

        # Origin detection is enabled after 0.45 by default.
        # Disable it since it silently fails.
        # Ref: https://github.com/DataDog/datadogpy/issues/764
        self.statsd._container_id = None

        # Applications should call wait_for_pending() before exiting to make sure all pending payloads are sent.
        atexit.register(self.statsd.wait_for_pending)

        super().__init__(prefix=prefix)

    def incr(
        self,
        key: str,
        instance: str | None = None,
        tags: Tags | None = None,
        amount: float | int = 1,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        self.statsd.increment(self._get_key(key), amount, sample_rate=sample_rate, tags=tags_list)

    def timing(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        self.statsd.distribution(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

    def gauge(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        self.statsd.gauge(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

    def distribution(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float = 1,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        self.statsd.distribution(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

    def event(
        self,
        title: str,
        message: str,
        alert_type: str | None = None,
        aggregation_key: str | None = None,
        source_type_name: str | None = None,
        priority: str | None = None,
        instance: str | None = None,
        tags: Tags | None = None,
        stacklevel: int = 0,
    ) -> None:
        tags = dict(tags or ())

        if self.tags:
            tags.update(self.tags)
        if instance:
            tags["instance"] = instance

        tags_list = [f"{k}:{v}" for k, v in tags.items()]
        self.statsd.event(
            title=title,
            message=message,
            alert_type=alert_type,
            aggregation_key=aggregation_key,
            source_type_name=source_type_name,
            priority=priority,
            tags=tags_list,
            hostname=self.host,
        )
