from __future__ import absolute_import

import six


def parse_addr(x):
    if x is None:
        return 0
    if isinstance(x, six.integer_types):
        return x
    if isinstance(x, six.string_types):
        if x[:2] == '0x':
            return int(x[2:], 16)
        return int(x)
    raise ValueError('Unsupported address format %r' % (x,))
