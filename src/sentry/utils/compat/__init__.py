from __future__ import absolute_import

import six

try:
    import cPickle as pickle
except ImportError:
    import pickle  # NOQA

_identity = lambda x: x

if six.PY2:
    # https://github.com/pallets/werkzeug/blob/master/werkzeug/_compat.py
    def implements_to_string(cls):
        cls.__unicode__ = cls.__str__
        cls.__str__ = lambda x: x.__unicode__().encode('utf-8')
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
