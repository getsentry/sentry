from typing import Protocol


class _SupportsClose(Protocol):
    def close(self) -> None: ...


class StatsClient:
    _sock: _SupportsClose

    def __init__(
        self,
        host: str = ...,
        port: int = ...,
        prefix: str | None = ...,
        maxudpsize: int = ...,
        ipv6: bool = ...,
    ) -> None: ...
    def incr(self, stat: str, count: float | int = ..., rate: float = ...) -> None: ...
    def timing(self, stat: str, delta: float, rate: float = ...) -> None: ...
    def gauge(
        self, stat: str, value: float, rate: float = ..., delta: bool = ...
    ) -> None: ...
    def set(self, stat: str, value: str | int, rate: float = ...) -> None: ...
