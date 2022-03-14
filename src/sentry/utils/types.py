from typing import Callable

from yaml.parser import ParserError
from yaml.scanner import ScannerError

from sentry.utils.yaml import safe_load

__all__ = ("InvalidTypeError", "Any", "Bool", "Int", "Float", "String", "Dict", "Sequence")


class InvalidTypeError(TypeError):
    pass


class Type:
    """Base Type that provides type coercion"""

    name = ""
    # Default value to be returned when initializing
    default = None
    # Types that do not need to be coerced
    expected_types = ()
    # Types that are acceptable for coercion
    compatible_types = (str,)

    def __call__(self, value=None):
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

    def _default(self):
        return self.default

    def test(self, value):
        """Check if the value is the correct type or not"""
        return isinstance(value, self.expected_types)

    def __repr__(self):
        return self.name


class AnyType(Type):
    """A type that accepts any value and does no coercion"""

    name = "any"
    expected_types = (object,)
    compatible_types = (object,)


class BoolType(Type):
    "Coerce a boolean from a string"
    name = "boolean"
    default = False
    expected_types = (bool,)
    compatible_types = (str, int)

    def convert(self, value):
        if isinstance(value, int):
            return bool(value)
        value = value.lower()
        if value in ("y", "yes", "t", "true", "1", "on"):
            return True
        if value in ("n", "no", "f", "false", "0", "off"):
            return False


class IntType(Type):
    """Coerce an integer from a string"""

    name = "integer"
    default = 0
    expected_types = (int,)

    def convert(self, value):
        try:
            return int(value)
        except ValueError:
            return


class FloatType(Type):
    """Coerce a float from a string or integer"""

    name = "float"
    default = 0.0
    expected_types = (float,)
    compatible_types = (str, int, float)

    def convert(self, value):
        try:
            return float(value)
        except ValueError:
            return


class StringType(Type):
    """String type without any coercion, must be a string"""

    name = "string"
    default = ""
    expected_types = (str,)
    compatible_types = (str,)


class DictType(Type):
    """Coerce a dict out of a json/yaml string"""

    name = "dictionary"
    expected_types = (dict,)

    def _default(self):
        # make sure we create a fresh dict each time
        return {}

    def convert(self, value):
        try:
            return safe_load(value)
        except (AttributeError, ParserError, ScannerError):
            return


class SequenceType(Type):
    """Coerce a tuple out of a json/yaml string or a list"""

    name = "sequence"
    default = ()
    expected_types = (tuple, list)
    compatible_types = (str, tuple, list)

    def convert(self, value):
        if isinstance(value, str):
            try:
                value = safe_load(value)
            except (AttributeError, ParserError, ScannerError):
                return
        if isinstance(value, list):
            value = tuple(value)
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
_type_mapping = {
    bool: Bool,
    int: Int,
    float: Float,
    bytes: String,
    str: String,
    dict: Dict,
    tuple: Sequence,
    list: Sequence,
}


def type_from_value(value):
    """Fetch Type based on a primitive value"""
    return _type_mapping[type(value)]


AnyCallable = Callable[..., Any]
