"""
Query generator backends for physical queries.
"""

from typing import Callable, Generic, Optional, TypeVar, cast

from .base import MetricsBackend

__all__ = (
    "MetricsBackend",
    "default_backend",
)

T = TypeVar("T")


class _Lazy(Generic[T]):
    def __init__(self, factory: Callable[[], T]):
        self._factory = factory
        self._wrapped: Optional[T] = None

    def __getattr__(self, name):
        if self._wrapped is None:
            self._wrapped = self._factory()
        return getattr(self._wrapped, name)


def _default_backend():
    from .snuba import SnubaMetricsBackend

    return SnubaMetricsBackend()


# Lazy load the default backend to prevent circular imports.
default_backend = cast(MetricsBackend, _Lazy(_default_backend))
