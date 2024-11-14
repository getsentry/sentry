from typing import Callable, TypeVar

TCallable = TypeVar("TCallable", bound=Callable[..., object])

class filemon:
    def __init__(self, fsobj: str, *, signum: int = ..., target: str = ...) -> None: ...
    def __call__(self, func: TCallable) -> TCallable: ...
