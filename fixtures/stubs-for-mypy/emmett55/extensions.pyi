from collections.abc import Callable
from enum import Enum
from typing import Any

from . import Config

class Signals(str, Enum):
    after_loop = "after_loop"
    after_route = "after_route"
    before_route = "before_route"
    before_routes = "before_routes"

class Extension:
    namespace: str | None = None
    default_config: dict[str, Any] = ...
    app: Any
    env: Any
    config: Config
    def __init__(self, app: Any, env: Any, config: Config) -> None: ...
    def on_load(self) -> None: ...

class listen_signal:
    def __init__(self, signal: Signals) -> None: ...
    def __call__[F: Callable[..., Any]](self, f: F) -> F: ...
