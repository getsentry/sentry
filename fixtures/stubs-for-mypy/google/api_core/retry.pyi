from collections.abc import Callable
from typing import Any

class Retry:
    def __init__(
        self,
        predicate: Callable[[BaseException], bool] | None = None,
        initial: float = ...,
        maximum: float = ...,
        multiplier: float = ...,
        deadline: float | None = ...,
        on_error: Callable[[BaseException], Any] | None = None,
    ) -> None: ...
    def __call__(self, func: Callable[..., Any]) -> Callable[..., Any]: ...

def if_exception_type(
    *exception_types: type[BaseException],
) -> Callable[[BaseException], bool]: ...
