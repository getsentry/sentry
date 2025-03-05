from typing import Generic, TypeVar

T = TypeVar("T")  # Success type
E = TypeVar("E")  # Error type


class Result(Generic[T, E]):
    """A Result type that can either contain a success value of type T or an error value of type E."""

    def __init__(self, value: T | None = None, error: E | None = None):
        if (value is None and error is None) or (value is not None and error is not None):
            raise ValueError("Result must have either a value or an error, but not both")
        self._value = value
        self._error = error

    @property
    def is_ok(self) -> bool:
        """Returns True if the result contains a success value."""
        return self._value is not None

    @property
    def is_err(self) -> bool:
        """Returns True if the result contains an error value."""
        return self._error is not None

    def unwrap(self) -> T:
        """Returns the success value if present, raises ValueError otherwise."""
        if self._value is None:
            raise ValueError(f"Cannot unwrap error result: {self._error}")
        return self._value

    def unwrap_err(self) -> E:
        """Returns the error value if present, raises ValueError otherwise."""
        if self._error is None:
            raise ValueError(f"Cannot unwrap ok result: {self._value}")
        return self._error

    @classmethod
    def ok(cls, value: T) -> "Result[T, E]":
        """Creates a new Result with a success value."""
        return cls(value=value)

    @classmethod
    def err(cls, error: E) -> "Result[T, E]":
        """Creates a new Result with an error value."""
        return cls(error=error)

    def map(self, f: callable[[T], T]) -> "Result[T, E]":
        """Applies a function to the success value if present."""
        if self.is_ok:
            return Result.ok(f(self._value))
        return self
