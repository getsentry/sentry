import atexit
from typing import Any

from datadog import initialize
from datadog.dogstatsd.base import statsd

from .base import MetricsBackend, Tags

__all__ = ["DogStatsdMetricsBackend"]

# Set the maximum number of packets to queue for the sender.
# How may packets to queue before blocking or dropping the packet if the packet queue is already full.
# 0 means unlimited.
SENDER_QUEUE_SIZE = 0

# Set timeout for packet queue operations, in seconds
# How long the application thread is willing to wait for the queue clear up before dropping the metric packet.
# If set to None, wait forever.
# If set to zero drop the packet immediately if the queue is full.
SENDER_QUEUE_TIMEOUT = 0


class DogStatsdMetricsBackend(MetricsBackend):
    def __init__(self, prefix: str | None = None, **kwargs: Any) -> None:
        # TODO(dcramer): it'd be nice if the initialize call wasn't a global
        self.tags = kwargs.pop("tags", None)
        kwargs["statsd_disable_buffering"] = False

        initialize(**kwargs)
        statsd.disable_telemetry()

        # When enabled, a background thread will be used to send metric payloads to the Agent.
        statsd.enable_background_sender(
            sender_queue_size=SENDER_QUEUE_SIZE, sender_queue_timeout=SENDER_QUEUE_TIMEOUT
        )
        # Applications should call wait_for_pending() before exiting to make sure all pending payloads are sent.
        atexit.register(statsd.wait_for_pending)

        # Origin detection is enabled after 0.45 by default.
        # Disable it since it silently fails.
        # Ref: https://github.com/DataDog/datadogpy/issues/764
        statsd._container_id = None
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
        statsd.increment(self._get_key(key), amount, sample_rate=sample_rate, tags=tags_list)

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
        statsd.timing(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

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
        statsd.gauge(self._get_key(key), value, sample_rate=sample_rate, tags=tags_list)

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
        # We keep the same implementation for Datadog.
        self.timing(key, value, instance, tags, sample_rate)

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
        statsd.event(
            title=title,
            message=message,
            alert_type=alert_type,
            aggregation_key=aggregation_key,
            source_type_name=source_type_name,
            priority=priority,
            tags=tags_list,
            hostname=self.host,
        )
