from __future__ import annotations

import typing

from typing_extensions import TypeGuard
from yaml.parser import ParserError
from yaml.scanner import ScannerError

from sentry.utils.yaml import safe_load

__all__ = ("InvalidTypeError", "Any", "Bool", "Int", "Float", "String", "Dict", "Sequence")

T = typing.TypeVar("T")


class InvalidTypeError(TypeError):
    pass


class Type(typing.Generic[T]):
    """Base Type that provides type coercion"""

    name = ""
    # Default value to be returned when initializing
    default: T
    # Types that do not need to be coerced
    expected_types: tuple[type[object], ...] = ()
    # Types that are acceptable for coercion
    compatible_types: tuple[type[object], ...] = (str,)

    def __call__(self, value: object | None = None) -> T:
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

    def _default(self) -> T:
        return self.default

    def test(self, value: object) -> TypeGuard[T]:
        """Check if the value is the correct type or not"""
        return isinstance(value, self.expected_types)

    def __repr__(self) -> str:
        return self.name


class AnyType(Type[typing.Any]):
    """A type that accepts any value and does no coercion"""

    name = "any"
    default = None
    expected_types = (object,)
    compatible_types = (object,)


class BoolType(Type[bool]):
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


class IntType(Type[int]):
    """Coerce an integer from a string"""

    name = "integer"
    default = 0
    expected_types = (int,)

    def convert(self, value):
        try:
            return int(value)
        except ValueError:
            return None


class FloatType(Type[float]):
    """Coerce a float from a string or integer"""

    name = "float"
    default = 0.0
    expected_types = (float,)
    compatible_types = (str, int, float)

    def convert(self, value):
        try:
            return float(value)
        except ValueError:
            return None


class StringType(Type[str]):
    """String type without any coercion, must be a string"""

    name = "string"
    default = ""
    expected_types = (str,)
    compatible_types = (str,)


class DictType(Type[dict]):
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


class SequenceType(Type[list]):
    """Coerce a list out of a json/yaml string or a list"""

    name = "sequence"
    expected_types = (list,)
    compatible_types = (str, tuple, list)

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
Any = AnyType()
Bool = BoolType()
Int = IntType()
Float = FloatType()
String = StringType()
Dict = DictType()
Sequence = SequenceType()

# Mapping for basic types into what their Type is
_type_mapping: dict[type[object], Type] = {
    bool: Bool,
    int: Int,
    float: Float,
    bytes: String,
    str: String,
    dict: Dict,
    list: Sequence,
}


# @typing.overload
# def type_from_value(value: bool) -> BoolType:


@typing.overload
def type_from_value(value: int) -> IntType:
    ...


@typing.overload
def type_from_value(value: float) -> FloatType:
    ...


@typing.overload
def type_from_value(value: bytes) -> StringType:
    ...


@typing.overload
def type_from_value(value: str) -> StringType:
    ...


@typing.overload
def type_from_value(value: dict) -> DictType:
    ...


@typing.overload
def type_from_value(value: list) -> SequenceType:
    ...


def type_from_value(value):
    """Fetch Type based on a primitive value"""
    return _type_mapping[type(value)]


AnyCallable = typing.Callable[..., AnyType]
