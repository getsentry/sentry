from __future__ import absolute_import

try:
    # TODO: remove when we drop Python 2.7 compat
    from mock import *  # NOQA
except ImportError:
    from unittest.mock import *  # NOQA
