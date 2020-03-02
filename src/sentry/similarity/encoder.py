from __future__ import absolute_import

from collections import Mapping, Set, Sequence

import six
from sentry.utils.compat import map


class Encoder(object):
    try:
        number_types = (int, long, float)  # noqa
    except NameError:
        number_types = (int, float)

    def __init__(self, types=None):
        self.types = types if types is not None else {}

    def dumps(self, value):
        for cls, function in self.types.items():
            if isinstance(value, cls):
                value = function(value)

        if isinstance(value, six.binary_type):
            return value
        elif isinstance(value, six.text_type):
            return value.encode("utf8")
        elif isinstance(value, self.number_types):
            return six.text_type(value).encode("utf8")
        elif isinstance(value, Set):
            return b"\x00".join(sorted(map(self.dumps, value)))
        elif isinstance(value, Sequence):
            return b"\x01".join(map(self.dumps, value))
        elif isinstance(value, Mapping):
            return b"\x02".join(
                sorted(b"\x01".join(map(self.dumps, item)) for item in value.items())
            )
        else:
            raise TypeError(u"Unsupported type: {}".format(type(value)))
