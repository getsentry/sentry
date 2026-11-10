from collections.abc import Callable
from typing import Any, TypeVar

from emmett_core.http.wrappers.request import Request
from emmett_core.http.wrappers.response import Response

from .ctx import current as current

_T = TypeVar("_T")

class Config:
    def __getattr__(self, name: str) -> Any: ...
    def __setattr__(self, name: str, value: Any) -> None: ...

class _RouteContext:
    def __call__[F: Callable[..., Any]](self, func: F) -> F: ...

class AppModule:
    pipeline: list[Pipe]
    config: Config
    def route(
        self,
        paths: str | list[str] | None = None,
        name: str | None = None,
        **kwargs: Any,
    ) -> _RouteContext: ...
    def websocket(
        self,
        paths: str | list[str] | None = None,
        name: str | None = None,
        **kwargs: Any,
    ) -> _RouteContext: ...

class App:
    config: Config
    log: Any
    _router_http: Any
    def __init__(self, import_name: str, **opts: Any) -> None: ...
    def module(self, import_name: str, name: str, **kwargs: Any) -> AppModule: ...
    def use_extension(self, ext_cls: type[_T]) -> _T: ...

class Pipe:
    output: str | None = None
    async def open(self) -> None: ...
    async def open_request(self) -> None: ...
    async def close(self) -> None: ...
    async def close_request(self) -> None: ...
    async def pipe(self, next_pipe: Any, **kwargs: Any) -> Any: ...
    async def pipe_request(self, next_pipe: Any, **kwargs: Any) -> Any: ...

def abort(code: int, body: str = "") -> None: ...
def redirect(path: str, code: int = 302) -> Any: ...
def now() -> Any: ...

request: Request
response: Response
session: Any
websocket: Any
