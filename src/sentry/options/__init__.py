"""
sentry.options
~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from .manager import OptionsManager
from .manager import DEFAULT_FLAGS, FLAG_IMMUTABLE, FLAG_NOSTORE, FLAG_STOREONLY  # NOQA

__all__ = (
    'get', 'set', 'delete', 'register',
)

default_manager = OptionsManager()

# expose public API
get = default_manager.get
set = default_manager.set
delete = default_manager.delete
register = default_manager.register

from .defaults import *  # NOQA
