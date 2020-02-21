from __future__ import absolute_import

from six.moves import filter as _filter

filter = lambda x: list(_filter(x))  # NOQA
