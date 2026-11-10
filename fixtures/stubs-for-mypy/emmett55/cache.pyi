from collections.abc import Callable
from typing import Any

class RamCache:
    def __init__(self, default_expire: int = ..., threshold: int = ..., **kwargs: Any) -> None: ...

class _CacheDecorator:
    def __call__[F: Callable[..., Any]](self, f: F) -> F: ...

class Cache:
    def __init__(self, **kwargs: Any) -> None: ...
    def __call__(
        self,
        key: str | None = ...,
        function: Any = ...,
        duration: int | str | None = ...,
    ) -> _CacheDecorator: ...
