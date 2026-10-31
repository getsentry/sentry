from __future__ import annotations

from collections.abc import Iterator, Sequence
from typing import Protocol, SupportsIndex, SupportsInt, TypeVar

_IntConvertible = SupportsInt | SupportsIndex | str | bytes | bytearray | float


def cmp(a: int, b: int) -> int:
    return (a > b) - (a < b)


_TPrepared = TypeVar("_TPrepared", covariant=True)


class _BitEvaluator(Protocol[_TPrepared]):
    def prepare_node(self, node: Bit, query: object, allow_joins: bool) -> _TPrepared: ...


class Bit:
    number: int
    is_set: bool
    mask: int
    children: list[Bit]

    def __init__(self, number: int, is_set: object = True) -> None:
        self.number = number
        self.is_set = bool(is_set)
        self.mask = 2 ** int(number)
        self.children: list[Bit] = []
        if not self.is_set:
            self.mask = ~self.mask

    def __repr__(self) -> str:
        return "<%s: number=%d, is_set=%s>" % (self.__class__.__name__, self.number, self.is_set)

    def __int__(self) -> int:
        return self.mask

    def __bool__(self) -> bool:
        return self.is_set

    def __eq__(self, value):
        if isinstance(value, Bit):
            return value.number == self.number and value.is_set == self.is_set
        elif isinstance(value, bool):
            return value == self.is_set
        elif isinstance(value, int):
            return value == self.mask
        return value == self.is_set

    def __ne__(self, value: object) -> bool:
        return not self == value

    def __coerce__(self, value: object) -> tuple[bool, bool]:
        return (self.is_set, bool(value))

    def __invert__(self) -> Bit:
        return self.__class__(self.number, not self.is_set)

    def __and__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return value & self.mask

    def __rand__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return self.mask & value

    def __or__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return value | self.mask

    def __ror__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return self.mask | value

    def __lshift__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return value << self.mask

    def __rlshift__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return self.mask << value

    def __rshift__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return value >> self.mask

    def __rrshift__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return self.mask >> value

    def __xor__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return value ^ self.mask

    def __rxor__(self, value):
        if isinstance(value, Bit):
            value = value.mask
        return self.mask ^ value

    def __sentry__(self) -> str:
        return repr(self)

    def evaluate(
        self, evaluator: object, qn: object, connection: object
    ) -> tuple[int, list[object]]:
        return self.mask, []

    def prepare(
        self, evaluator: _BitEvaluator[_TPrepared], query: object, allow_joins: bool
    ) -> _TPrepared:
        return evaluator.prepare_node(self, query, allow_joins)


class BitHandler:
    """
    Represents an array of bits, each as a ``Bit`` object.
    """

    _value: int
    _keys: Sequence[str]
    _labels: Sequence[object]

    def __init__(
        self,
        value: _IntConvertible | None,
        keys: Sequence[str],
        labels: Sequence[object] | None = None,
    ) -> None:
        # TODO: change to bitarray?
        if value:
            self._value = int(value)
        else:
            self._value = 0
        self._keys = keys
        self._labels = labels is not None and labels or keys

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BitHandler):
            return False
        return self._value == other._value

    def __lt__(self, other):
        return int(self._value) < other

    def __le__(self, other):
        return int(self._value) <= other

    def __gt__(self, other):
        return int(self._value) > other

    def __ge__(self, other):
        return int(self._value) >= other

    def __cmp__(self, other):
        return cmp(self._value, other)

    def __repr__(self) -> str:
        return "<{}: {}>".format(
            self.__class__.__name__,
            ", ".join(f"{k}={self.get_bit(n).is_set}" for n, k in enumerate(self._keys)),
        )

    def __str__(self) -> str:
        return str(self._value)

    def __int__(self) -> int:
        return self._value

    def __bool__(self) -> bool:
        return bool(self._value)

    def __and__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value & int(value), self._keys)

    def __or__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value | int(value), self._keys)

    def __add__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value + int(value), self._keys)

    def __sub__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value - int(value), self._keys)

    def __lshift__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value << int(value), self._keys)

    def __rshift__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value >> int(value), self._keys)

    def __xor__(self, value: _IntConvertible) -> BitHandler:
        return BitHandler(self._value ^ int(value), self._keys)

    def __contains__(self, key: str) -> bool:
        bit_number = self._keys.index(key)
        return bool(self.get_bit(bit_number))

    def __getattr__(self, key):
        if key.startswith("_"):
            return object.__getattribute__(self, key)
        if key not in self._keys:
            raise AttributeError("%s is not a valid flag" % key)
        return self.get_bit(self._keys.index(key))

    __getitem__ = __getattr__

    def __setattr__(self, key: str, value: object) -> None:
        if key.startswith("_"):
            return object.__setattr__(self, key, value)
        if key not in self._keys:
            raise AttributeError("%s is not a valid flag" % key)
        self.set_bit(self._keys.index(key), value)

    __setitem__ = __setattr__

    def __iter__(self) -> Iterator[tuple[str, bool]]:
        return self.iteritems()

    def __sentry__(self) -> str:
        return repr(self)

    def _get_mask(self) -> int:
        return self._value

    mask = property(_get_mask)

    def evaluate(
        self, evaluator: object, qn: object, connection: object
    ) -> tuple[int, list[object]]:
        return self.mask, []

    def get_bit(self, bit_number: int) -> Bit:
        mask = 2 ** int(bit_number)
        return Bit(bit_number, self._value & mask != 0)

    def set_bit(self, bit_number: int, true_or_false: object) -> Bit:
        mask = 2 ** int(bit_number)
        if true_or_false:
            self._value |= mask
        else:
            self._value &= ~mask
        return Bit(bit_number, self._value & mask != 0)

    def keys(self) -> Sequence[str]:
        return self._keys

    def iterkeys(self) -> Iterator[str]:
        return iter(self._keys)

    def items(self) -> list[tuple[str, bool]]:
        return list(self.iteritems())

    def iteritems(self) -> Iterator[tuple[str, bool]]:
        for k in self._keys:
            yield (k, getattr(self, k).is_set)

    def get_label(self, flag: str | Bit | int) -> object:
        if isinstance(flag, str):
            flag = self._keys.index(flag)
        if isinstance(flag, Bit):
            flag = flag.number
        return self._labels[flag]


# We need to register adapters in Django 1.8 in order to prevent
# "ProgrammingError: can't adapt type"
import psycopg2.extensions

psycopg2.extensions.register_adapter(Bit, lambda x: psycopg2.extensions.AsIs(int(x)))
psycopg2.extensions.register_adapter(BitHandler, lambda x: psycopg2.extensions.AsIs(int(x)))
