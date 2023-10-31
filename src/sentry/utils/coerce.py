from __future__ import annotations

import typing

from typing_extensions import TypeGuard
from yaml.parser import ParserError
from yaml.scanner import ScannerError

from sentry.utils.yaml import safe_load

__all__ = ("InvalidTypeError", "Any", "Bool", "Int", "Float", "String", "Dict", "Sequence")

From = typing.TypeVar("From")
To = typing.TypeVar("To")
T = typing.TypeVar("T")
K = typing.TypeVar("K")
V = typing.TypeVar("V")


class InvalidTypeError(TypeError):
    pass


class Coercion(typing.Generic[From, To]):
    """Base type that provides type coercion"""

    name = ""
    # Default value to be returned when initializing
    default: To
    # Types that do not need to be coerced
    expected_types: tuple[type[To], ...]
    # Types that are acceptable for coercion
    compatible_types: tuple[type[From], ...]

    def __call__(self, value: From | To | None = None) -> To:
        if value is None:
            return self._default()
        if self.test(value):
            return value
        if isinstance(value, self.compatible_types):
            rv = self.convert(value)
            # Make sure convert was able to do the right thing
            # and give us the type we were expecting
            if self.test(rv):
                return rv
        raise InvalidTypeError(f"{value!r} is not a valid {self!r}")

    def convert(self, value):
        return value

    def _default(self) -> To:
        return self.default

    def test(self, value: object) -> TypeGuard[To]:
        """Check if the value is the correct type or not"""
        return isinstance(value, self.expected_types)

    def __repr__(self) -> str:
        return self.name


class AnyCoercion(Coercion[typing.Any, typing.Any]):
    """A type that accepts any value and does no coercion"""

    name = "any"
    default = None
    expected_types = (object,)
    compatible_types = (object,)


class BoolCoercion(Coercion["str | int", bool]):
    "Coerce a boolean from a string"
    name = "boolean"
    default = False
    expected_types = (bool,)
    compatible_types = (str, int)

    def convert(self, value):
        if isinstance(value, int):
            return bool(value)
        value = value.lower()
        if value in ("y", "yes", "t", "true", "True", "1", "on"):
            return True
        elif value in ("n", "no", "f", "false", "False", "0", "off"):
            return False
        else:
            return None


class IntCoercion(Coercion[str, int]):
    """Coerce an integer from a string"""

    name = "integer"
    default = 0
    expected_types = (int,)

    def convert(self, value):
        try:
            return int(value)
        except ValueError:
            return None


class FloatCoercion(Coercion["str | int", float]):
    """Coerce a float from a string or integer"""

    name = "float"
    default = 0.0
    expected_types = (float,)
    compatible_types = (str, int)

    def convert(self, value):
        try:
            return float(value)
        except ValueError:
            return None


class StringCoercion(Coercion[str, str]):
    """String type without any coercion, must be a string"""

    name = "string"
    default = ""
    expected_types = (str,)
    compatible_types = (str,)


class DictCoercion(typing.Generic[K, V], Coercion[str, typing.Dict[K, V]]):
    """Coerce a dict out of a json/yaml string"""

    name = "dictionary"
    expected_types = (dict,)

    def _default(self) -> dict[str, typing.Any]:
        # make sure we create a fresh dict each time
        return {}

    def convert(self, value):
        try:
            return safe_load(value)
        except (AttributeError, ParserError, ScannerError):
            return None


class SequenceCoercion(typing.Generic[T], Coercion["str | tuple", typing.List[T]]):
    """Coerce a list out of a json/yaml string or a list"""

    name = "sequence"
    expected_types = (list,)
    compatible_types = (str, tuple)

    def _default(self) -> typing.List[typing.Any]:
        # make sure we create a fresh list each time
        return []

    def convert(self, value):
        if isinstance(value, str):
            try:
                value = safe_load(value)
            except (AttributeError, ParserError, ScannerError):
                return None
        if isinstance(value, tuple):
            value = list(value)
        return value


# Initialize singletons of each type for easy reuse
Any = AnyCoercion()
Bool = BoolCoercion()
Int = IntCoercion()
Float = FloatCoercion()
String = StringCoercion()
Dict = DictCoercion()
Sequence = SequenceCoercion()

# Find a coercion, given a destination type
_to_type: dict[type[object], Coercion] = {
    bool: Bool,
    int: Int,
    float: Float,
    bytes: String,
    str: String,
    dict: Dict,
    list: Sequence,
}


@typing.overload
def to_type(type: None) -> StringCoercion:
    ...


@typing.overload
def to_type(type: type[bool]) -> BoolCoercion:
    ...


@typing.overload
def to_type(type: type[int]) -> IntCoercion:
    ...


@typing.overload
def to_type(type: type[float]) -> FloatCoercion:
    ...


@typing.overload
def to_type(type: type[bytes]) -> StringCoercion:
    ...


@typing.overload
def to_type(type: type[str]) -> StringCoercion:
    ...


@typing.overload
def to_type(type: type[dict[K, V]]) -> DictCoercion[K, V]:
    ...


@typing.overload
def to_type(type: type[list[T]]) -> SequenceCoercion[T]:
    ...


def to_type(type):
    """Fetch Coercion based on a primitive value"""
    return _to_type[type]
