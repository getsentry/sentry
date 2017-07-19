"""
Python 2 + 3 compatibility functions. This is a very small subset of six.
"""

import sys

PY3 = sys.version_info[0] == 3

if PY3:
    string_types = str,
    text_type = str
    raw_input = input

    import io
    StringIO = io.StringIO

else:
    string_types = basestring,
    text_type = unicode
    raw_input = raw_input

    import cStringIO
    StringIO = cStringIO.StringIO


def with_metaclass(meta, base=object):
    """Create a base class with a metaclass."""
    return meta("NewBase", (base,), {})


def _add_doc(func, doc):
    """Add documentation to a function."""
    func.__doc__ = doc

if PY3:
    def iteritems(d, **kw):
        return iter(d.items(**kw))
else:
    def iteritems(d, **kw):
        return iter(d.iteritems(**kw))

_add_doc(iteritems,
         "Return an iterator over the (key, value) pairs of a dictionary.")
