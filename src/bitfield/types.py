from __future__ import absolute_import

import six

from six import string_types
from sentry.utils.compat import implements_to_string


def cmp(a, b):
    return (a > b) - (a < b)


class Bit(object):
    def __init__(self, number, is_set=True):
        self.number = number
        self.is_set = bool(is_set)
        self.mask = 2 ** int(number)
        self.children = []
        if not self.is_set:
            self.mask = ~self.mask

    def __repr__(self):
        return "<%s: number=%d, is_set=%s>" % (self.__class__.__name__, self.number, self.is_set)

    def __int__(self):
        return self.mask

    def __bool__(self):
        return self.is_set

    __nonzero__ = __bool__

    def __eq__(self, value):
        if isinstance(value, Bit):
            return value.number == self.number and value.is_set == self.is_set
        elif isinstance(value, bool):
            return value == self.is_set
        elif isinstance(value, int):
            return value == self.mask
        return value == self.is_set

    def __ne__(self, value):
        return not self == value

    def __coerce__(self, value):
        return (self.is_set, bool(value))

    def __invert__(self):
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

    def __sentry__(self):
        return repr(self)

    def evaluate(self, evaluator, qn, connection):
        return self.mask, []

    def prepare(self, evaluator, query, allow_joins):
        return evaluator.prepare_node(self, query, allow_joins)


@implements_to_string
class BitHandler(object):
    """
    Represents an array of bits, each as a ``Bit`` object.
    """

    def __init__(self, value, keys, labels=None):
        # TODO: change to bitarray?
        if value:
            self._value = int(value)
        else:
            self._value = 0
        self._keys = keys
        self._labels = labels is not None and labels or keys

    def __eq__(self, other):
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

    def __repr__(self):
        return "<%s: %s>" % (
            self.__class__.__name__,
            ", ".join("%s=%s" % (k, self.get_bit(n).is_set) for n, k in enumerate(self._keys)),
        )

    def __str__(self):
        return six.text_type(self._value)

    def __int__(self):
        return self._value

    def __bool__(self):
        return bool(self._value)

    __nonzero__ = __bool__

    def __and__(self, value):
        return BitHandler(self._value & int(value), self._keys)

    def __or__(self, value):
        return BitHandler(self._value | int(value), self._keys)

    def __add__(self, value):
        return BitHandler(self._value + int(value), self._keys)

    def __sub__(self, value):
        return BitHandler(self._value - int(value), self._keys)

    def __lshift__(self, value):
        return BitHandler(self._value << int(value), self._keys)

    def __rshift__(self, value):
        return BitHandler(self._value >> int(value), self._keys)

    def __xor__(self, value):
        return BitHandler(self._value ^ int(value), self._keys)

    def __contains__(self, key):
        bit_number = self._keys.index(key)
        return bool(self.get_bit(bit_number))

    def __getattr__(self, key):
        if key.startswith("_"):
            return object.__getattribute__(self, key)
        if key not in self._keys:
            raise AttributeError("%s is not a valid flag" % key)
        return self.get_bit(self._keys.index(key))

    __getitem__ = __getattr__

    def __setattr__(self, key, value):
        if key.startswith("_"):
            return object.__setattr__(self, key, value)
        if key not in self._keys:
            raise AttributeError("%s is not a valid flag" % key)
        self.set_bit(self._keys.index(key), value)

    __setitem__ = __setattr__

    def __iter__(self):
        return self.iteritems()  # NOQA

    def __sentry__(self):
        return repr(self)

    def _get_mask(self):
        return self._value

    mask = property(_get_mask)

    def evaluate(self, evaluator, qn, connection):
        return self.mask, []

    def get_bit(self, bit_number):
        mask = 2 ** int(bit_number)
        return Bit(bit_number, self._value & mask != 0)

    def set_bit(self, bit_number, true_or_false):
        mask = 2 ** int(bit_number)
        if true_or_false:
            self._value |= mask
        else:
            self._value &= ~mask
        return Bit(bit_number, self._value & mask != 0)

    def keys(self):
        return self._keys

    def iterkeys(self):
        return iter(self._keys)

    def items(self):
        return list(self.iteritems())  # NOQA

    def iteritems(self):
        for k in self._keys:
            yield (k, getattr(self, k).is_set)

    def get_label(self, flag):
        if isinstance(flag, string_types):
            flag = self._keys.index(flag)
        if isinstance(flag, Bit):
            flag = flag.number
        return self._labels[flag]


from django.core.exceptions import ImproperlyConfigured

# We need to register adapters in Django 1.8 in order to prevent
# "ProgrammingError: can't adapt type"
try:
    from django.db.backends.postgresql_psycopg2.base import Database

    Database.extensions.register_adapter(Bit, lambda x: Database.extensions.AsIs(int(x)))
    Database.extensions.register_adapter(BitHandler, lambda x: Database.extensions.AsIs(int(x)))
except ImproperlyConfigured:
    pass
