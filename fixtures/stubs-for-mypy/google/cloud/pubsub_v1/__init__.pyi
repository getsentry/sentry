from typing import Any


class BatchSettings:
    def __init__(
        self,
        *,
        max_bytes: int = ...,
        max_latency: float = ...,
        max_messages: int = ...,
    ) -> None: ...


class _Types:
    BatchSettings: type[BatchSettings]


types: _Types


class PublisherClient:
    def __init__(self, batch_settings: BatchSettings | None = ..., **kwargs: Any) -> None: ...
    def topic_path(self, project: str, topic: str) -> str: ...
    def publish(self, topic: str, data: bytes, **attrs: str) -> Any: ...
