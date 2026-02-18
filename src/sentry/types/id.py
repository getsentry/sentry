from __future__ import annotations

from typing import Generic, TypeVar

_M = TypeVar("_M")


class Id(int, Generic[_M]):
    """
    Typed integer ID parameterized by model type.

    Id[Organization] and Id[Project] are distinct at type-check time
    but both are plain ints at runtime.
    """

    pass
