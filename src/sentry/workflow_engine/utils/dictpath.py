from __future__ import annotations

from typing import Protocol, cast, int


def _tname(t: type | tuple[type, ...]) -> str:
    if isinstance(t, type):
        return t.__name__
    return " | ".join(t.__name__ for t in t)


class Result[T](Protocol):
    """
    A result type for safe dictionary traversal operations.

    Provides a monadic interface for chaining operations that may fail,
    with automatic error propagation and type-safe value extraction.
    """

    def is_type[V](self, t: type[V]) -> Result[V]:
        """Validate that the contained value is of the expected type."""
        ...

    def failed(self) -> bool:
        """Check if this result represents a failure."""
        ...

    def get(self, fallback: T | None = None) -> T:
        """Extract the value, raising an exception on failure unless fallback is provided."""
        ...

    def get_or_none(self) -> T | None:
        """Extract the value, returning None on failure."""
        ...

    def list_of[V](self, t: type[V]) -> Result[list[V]]:
        """Validate that the contained value is a list of the expected type."""
        ...


class _FailedResultImpl[T]:
    def __init__(self, exc: ValueError) -> None:
        self._exc = exc

    def failed(self) -> bool:
        return True

    def get(self, fallback: T | None = None) -> T:
        if fallback is not None:
            return fallback
        raise self._exc

    def get_or_none(self) -> T | None:
        return None

    def is_type[V](self, t: type[V]) -> Result[V]:
        return cast(Result[V], self)
        # return _FailedResultImpl[V](self._exc)

    def list_of[V](self, t: type[V]) -> Result[list[V]]:
        return _FailedResultImpl[list[V]](self._exc)


def _dictpath_error(path: list[str], msg: str) -> ValueError:
    return ValueError(f"{'.'.join(path)}: {msg}")


def _failure[T](path: list[str], msg: str) -> Result[T]:
    return _FailedResultImpl[T](_dictpath_error(path, msg))


class _SuccessResultImpl[T]:
    def __init__(self, path: list[str], v: T) -> None:
        self._path = path
        self._v = v

    def failed(self) -> bool:
        return False

    def get(self, fallback: T | None = None) -> T:
        return self._v

    def get_or_none(self) -> T | None:
        return self._v

    def is_type[V](self, t: type[V]) -> Result[V]:
        v = self._v
        if not isinstance(v, t):
            return _failure(self._path, f"Expected {_tname(t)}, got {_tname(type(v))}")
        return cast(Result[V], self)

    def list_of[V](self, t: type[V]) -> Result[list[V]]:
        rr = self.is_type(list)
        if rr.failed():
            return rr
        v = rr.get()
        if not all(isinstance(item, t) for item in v):
            return _failure(self._path, f"Expected list of {_tname(t)}, got {_tname(type(v))}")
        return cast(Result[list[V]], self)


def _success[T](path: list[str], v: T) -> Result[T]:
    return _SuccessResultImpl[T](path, v)


def walk(data: object, *path: str) -> Result[object]:
    """
    Traverse an object based on a path and return a result.

    Example:
        >>> walk({"a": {"b": "c"}}, "a", "b").get()
        "c"
        >>> walk({"a": {"b": "c"}}, "e", "f", "g").get()
        ValueError: e.f.g: not found!
        >>> walk({"a": {"b": "c"}}, "a", "b", "c").is_type(int).get()
        ValueError: a.b.c: Expected int, got str
    """
    current = data
    history = []
    for pathelt in path:
        history.append(pathelt)
        if not isinstance(current, dict):
            return _failure(history, "was not a dict!")
        if pathelt not in current:
            return _failure(history, "not found!")
        current = current[pathelt]
    return _success(history, current)
