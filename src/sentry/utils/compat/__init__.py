from __future__ import absolute_import

import six

try:
    import cPickle as pickle
except ImportError:
    import pickle  # NOQA

try:
    # TODO: remove when we drop Python 2.7 compat
    import functools32 as functools
except ImportError:
    import functools  # NOQA

from six.moves import map as _map
from six.moves import filter as _filter
from six.moves import zip as _zip


def map(a, b, *c):
    return list(_map(a, b, *c))


def filter(a, b):
    return list(_filter(a, b))


def zip(*a):
    return list(_zip(*a))


def _identity(x):
    return x


if six.PY2:
    # https://github.com/pallets/werkzeug/blob/master/werkzeug/_compat.py
    def implements_to_string(cls):
        cls.__unicode__ = cls.__str__
        cls.__str__ = lambda x: x.__unicode__().encode("utf-8")
        return cls

    def implements_iterator(cls):
        cls.next = cls.__next__
        del cls.__next__
        return cls

    def implements_bool(cls):
        cls.__nonzero__ = cls.__bool__
        del cls.__bool__
        return cls


else:
    implements_to_string = _identity
    implements_iterator = _identity
    implements_bool = _identity
