from __future__ import absolute_import

from six.moves import map as _map

map = lambda x: list(_map(x))  # NOQA
